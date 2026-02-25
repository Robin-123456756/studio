/**
 * Scoring Engine Tests
 *
 * Tests computeUserScore() — the pure function that takes roster rows,
 * player stats, and player metadata, and returns a scored result with
 * auto-sub, vice-captain, and bench boost logic.
 *
 * No database or network calls — everything is in-memory.
 */

import { describe, it, expect } from "vitest";
import {
  computeUserScore,
  type RosterRow,
  type PlayerStat,
  type PlayerMeta,
} from "./scoring-engine";

// ── Test Helpers ──────────────────────────────────────────────────────

const USER = "user-1";

/** Create a roster row with sensible defaults */
function roster(
  playerId: string,
  overrides: Partial<RosterRow> = {},
): RosterRow {
  return {
    user_id: USER,
    player_id: playerId,
    is_starting_9: true,
    is_captain: false,
    is_vice_captain: false,
    multiplier: 1,
    active_chip: null,
    bench_order: null,
    ...overrides,
  };
}

/** Create a player stat entry */
function stat(playerId: string, points: number, didPlay = true): PlayerStat {
  return { player_id: playerId, points, did_play: didPlay };
}

/** Create player metadata */
function meta(
  id: string,
  position: string,
  isLady = false,
): PlayerMeta {
  return { id, position, is_lady: isLady };
}

// ── Standard 17-player squad ──────────────────────────────────────────
//
// Starting XI (10): gk1, def1, def2, mid1, mid2, mid3, mid4, fwd1, fwd2, lady1
// Bench (7):        gk2, def3, mid5, mid6, fwd3, lady2, def4
//
// Positions:  GK=2, DEF=4, MID=6, FWD=3, Lady FWD=2  (total 17)
// Starting:   GK=1, DEF=2, MID=4, FWD=2 (1 lady) = 10 ✓

const STARTING = [
  roster("gk1", { is_captain: true, multiplier: 2 }),
  roster("def1"),
  roster("def2"),
  roster("mid1"),
  roster("mid2"),
  roster("mid3"),
  roster("mid4"),
  roster("fwd1"),
  roster("fwd2"),
  roster("lady1"),
];

const BENCH = [
  roster("gk2", { is_starting_9: false, bench_order: 1 }),
  roster("def3", { is_starting_9: false, bench_order: 2 }),
  roster("mid5", { is_starting_9: false, bench_order: 3 }),
  roster("mid6", { is_starting_9: false, bench_order: 4 }),
  roster("fwd3", { is_starting_9: false, bench_order: 5 }),
  roster("lady2", { is_starting_9: false, bench_order: 6 }),
  roster("def4", { is_starting_9: false, bench_order: 7 }),
];

function fullSquad(overrides: Partial<RosterRow>[] = []): RosterRow[] {
  const squad = [...STARTING, ...BENCH].map((r) => ({ ...r }));
  for (const o of overrides) {
    const idx = squad.findIndex((r) => r.player_id === o.player_id);
    if (idx >= 0) Object.assign(squad[idx], o);
  }
  return squad;
}

/** Default metadata for all 17 players */
const META_MAP = new Map<string, PlayerMeta>([
  ["gk1", meta("gk1", "GK")],
  ["gk2", meta("gk2", "GK")],
  ["def1", meta("def1", "DEF")],
  ["def2", meta("def2", "DEF")],
  ["def3", meta("def3", "DEF")],
  ["def4", meta("def4", "DEF")],
  ["mid1", meta("mid1", "MID")],
  ["mid2", meta("mid2", "MID")],
  ["mid3", meta("mid3", "MID")],
  ["mid4", meta("mid4", "MID")],
  ["mid5", meta("mid5", "MID")],
  ["mid6", meta("mid6", "MID")],
  ["fwd1", meta("fwd1", "FWD")],
  ["fwd2", meta("fwd2", "FWD")],
  ["fwd3", meta("fwd3", "FWD")],
  ["lady1", meta("lady1", "FWD", true)],
  ["lady2", meta("lady2", "FWD", true)],
]);

/** All 17 players played, each with given points (default 5) */
function allPlayedStats(pts = 5): Map<string, PlayerStat> {
  const m = new Map<string, PlayerStat>();
  for (const [id] of META_MAP) {
    m.set(id, stat(id, pts));
  }
  return m;
}

// ══════════════════════════════════════════════════════════════════════
// TESTS
// ══════════════════════════════════════════════════════════════════════

describe("computeUserScore", () => {
  // ── Basic scoring ──────────────────────────────────────────────────

  describe("basic scoring (all starters play)", () => {
    it("sums starting XI points with captain 2x", () => {
      const stats = allPlayedStats(5);
      const result = computeUserScore(fullSquad(), stats, META_MAP);

      // 9 starters × 5 = 45, captain (gk1) × 5 × 2 = 10 → total 55
      expect(result.totalPoints).toBe(55);
      expect(result.autoSubs).toHaveLength(0);
      expect(result.captainActivated).toBe("captain");
      expect(result.benchBoost).toBe(false);
    });

    it("handles different points per player", () => {
      const stats = allPlayedStats(0);
      stats.set("gk1", stat("gk1", 3));   // captain → 3 × 2 = 6
      stats.set("mid1", stat("mid1", 10)); // 10
      stats.set("fwd1", stat("fwd1", 7));  // 7
      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.totalPoints).toBe(6 + 10 + 7); // 23
    });

    it("bench players do NOT score in normal mode", () => {
      const stats = allPlayedStats(0);
      stats.set("gk2", stat("gk2", 100)); // bench GK with 100 pts
      stats.set("mid5", stat("mid5", 50)); // bench MID with 50 pts
      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.totalPoints).toBe(0); // all starters have 0, bench doesn't count
    });
  });

  // ── Captain / Vice-Captain ─────────────────────────────────────────

  describe("captain and vice-captain", () => {
    it("captain gets 2x when played", () => {
      const stats = allPlayedStats(0);
      stats.set("gk1", stat("gk1", 10)); // captain
      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.totalPoints).toBe(20); // 10 × 2
      expect(result.captainActivated).toBe("captain");
    });

    it("vice-captain gets 2x when captain didn't play", () => {
      const stats = allPlayedStats(0);
      stats.set("gk1", stat("gk1", 10, false)); // captain didn't play
      stats.set("def1", stat("def1", 8));          // vice played

      const squad = fullSquad([
        { player_id: "def1", is_vice_captain: true },
      ]);
      const result = computeUserScore(squad, stats, META_MAP);

      expect(result.captainActivated).toBe("vice");
      // def1 = 8 × 2 = 16 (vice gets captain multiplier)
      expect(result.totalPoints).toBe(16);
    });

    it("no multiplier when both captain and vice didn't play", () => {
      const stats = allPlayedStats(5);
      stats.set("gk1", stat("gk1", 10, false)); // captain out
      stats.set("def1", stat("def1", 8, false)); // vice out

      const squad = fullSquad([
        { player_id: "def1", is_vice_captain: true },
      ]);
      const result = computeUserScore(squad, stats, META_MAP);

      expect(result.captainActivated).toBe("none");
      // 8 remaining starters × 5 = 40 + 2 auto-subs (gk2 + def3) × 5 = 10 → 50
      expect(result.totalPoints).toBe(50);
    });
  });

  // ── Triple Captain ─────────────────────────────────────────────────

  describe("triple captain chip", () => {
    it("captain gets 3x with triple captain chip", () => {
      const stats = allPlayedStats(0);
      stats.set("gk1", stat("gk1", 10)); // captain

      const squad = fullSquad().map((r) => ({
        ...r,
        active_chip: "triple_captain",
      }));
      const result = computeUserScore(squad, stats, META_MAP);

      expect(result.totalPoints).toBe(30); // 10 × 3
      expect(result.captainActivated).toBe("captain");
    });

    it("vice gets 3x when captain didn't play with triple captain", () => {
      const stats = allPlayedStats(0);
      stats.set("gk1", stat("gk1", 10, false)); // captain out
      stats.set("def1", stat("def1", 6));

      const squad = fullSquad([
        { player_id: "def1", is_vice_captain: true },
      ]).map((r) => ({ ...r, active_chip: "triple_captain" }));
      const result = computeUserScore(squad, stats, META_MAP);

      expect(result.captainActivated).toBe("vice");
      expect(result.totalPoints).toBe(18); // 6 × 3
    });
  });

  // ── Auto-Substitution ──────────────────────────────────────────────

  describe("auto-substitution", () => {
    it("subs in first valid bench player by bench_order", () => {
      const stats = allPlayedStats(5);
      stats.set("mid4", stat("mid4", 5, false)); // starter MID didn't play
      stats.set("mid5", stat("mid5", 8));         // bench MID (order 3) played

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.autoSubs).toHaveLength(1);
      expect(result.autoSubs[0].outId).toBe("mid4");
      // bench order: gk2(1)=GK can't sub outfield, def3(2)=DEF is first valid
      // DEF replacing MID → 1GK+3DEF+3MID+3FWD = valid formation
      expect(result.autoSubs[0].inId).toBe("def3");
    });

    it("respects bench order priority", () => {
      const stats = allPlayedStats(5);
      stats.set("def2", stat("def2", 5, false)); // starter DEF out

      // def3 is bench_order=2, def4 is bench_order=7
      // def3 should be picked first
      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.autoSubs).toHaveLength(1);
      expect(result.autoSubs[0].outId).toBe("def2");
      expect(result.autoSubs[0].inId).toBe("def3");
    });

    it("skips bench players who didn't play", () => {
      const stats = allPlayedStats(5);
      stats.set("mid4", stat("mid4", 5, false)); // starter MID out
      stats.set("gk2", stat("gk2", 5, false));   // bench_order 1 — didn't play
      stats.set("def3", stat("def3", 5, false));  // bench_order 2 — didn't play
      stats.set("mid5", stat("mid5", 8));          // bench_order 3 — played

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.autoSubs).toHaveLength(1);
      expect(result.autoSubs[0].inId).toBe("mid5");
    });

    it("GK only swaps with GK", () => {
      const stats = allPlayedStats(5);
      stats.set("gk1", stat("gk1", 5, false)); // starting GK out

      // bench_order: gk2(1)=GK, def3(2)=DEF, mid5(3)=MID...
      // Only gk2 can replace gk1
      const squad = fullSquad([
        { player_id: "def1", is_vice_captain: true },
      ]);
      const result = computeUserScore(squad, stats, META_MAP);

      expect(result.autoSubs).toHaveLength(1);
      expect(result.autoSubs[0].outId).toBe("gk1");
      expect(result.autoSubs[0].inId).toBe("gk2");
    });

    it("GK not subbed by outfield player even if bench order is lower", () => {
      const stats = allPlayedStats(5);
      stats.set("gk1", stat("gk1", 5, false)); // GK out
      stats.set("gk2", stat("gk2", 5, false)); // bench GK also out

      const squad = fullSquad([
        { player_id: "def1", is_vice_captain: true },
      ]);
      const result = computeUserScore(squad, stats, META_MAP);

      // No valid sub — no GK available on bench
      expect(result.autoSubs).toHaveLength(0);
    });

    it("lady only swaps with lady", () => {
      const stats = allPlayedStats(5);
      stats.set("lady1", stat("lady1", 5, false)); // lady starter out

      // lady2 is on bench (order 6). Non-lady FWDs (fwd3, order 5) should be skipped.
      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.autoSubs).toHaveLength(1);
      expect(result.autoSubs[0].outId).toBe("lady1");
      expect(result.autoSubs[0].inId).toBe("lady2");
    });

    it("non-lady forward NOT replaced by lady bench player", () => {
      const stats = allPlayedStats(5);
      stats.set("fwd1", stat("fwd1", 5, false)); // non-lady FWD out

      // bench order: gk2(1)=GK skip, def3(2)=DEF valid (formation stays ok)
      // def3 is first valid non-GK, non-lady sub
      // lady2 would be skipped (lady can't sub for non-lady)
      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.autoSubs).toHaveLength(1);
      // def3 replaces fwd1: 1GK+3DEF+4MID+1FWD+1lady = valid
      expect(result.autoSubs[0].inId).toBe("def3");
      // Verify lady2 was NOT chosen
      expect(result.autoSubs[0].inId).not.toBe("lady2");
    });

    it("no sub when no valid bench player available", () => {
      const stats = allPlayedStats(5);
      stats.set("lady1", stat("lady1", 5, false)); // lady out
      stats.set("lady2", stat("lady2", 5, false)); // bench lady also out

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      // No lady available on bench → no sub
      expect(result.autoSubs).toHaveLength(0);
    });

    it("absent starter scores 0 when no valid sub exists", () => {
      const stats = allPlayedStats(10);
      stats.set("lady1", stat("lady1", 10, false)); // lady out, 10pts
      stats.set("lady2", stat("lady2", 10, false)); // bench lady also out

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      // 9 starters × 10 = 90, captain gk1 × 10 × 2 = 20 → 90 + 10 = 100
      // lady1 doesn't score (absent, no sub)
      expect(result.totalPoints).toBe(100);
    });

    it("auto-subbed player's points count", () => {
      const stats = allPlayedStats(0);
      stats.set("mid4", stat("mid4", 0, false)); // starter MID out
      stats.set("def3", stat("def3", 12));        // bench DEF (order 2) will sub in

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.autoSubs).toHaveLength(1);
      expect(result.autoSubs[0].inId).toBe("def3");
      expect(result.totalPoints).toBe(12); // only def3 has points
    });

    it("handles multiple absent starters", () => {
      const stats = allPlayedStats(5);
      stats.set("mid3", stat("mid3", 5, false)); // MID out
      stats.set("mid4", stat("mid4", 5, false)); // MID out
      // bench order: gk2(1)=GK skip, def3(2)=DEF first valid, mid5(3)=MID second valid
      stats.set("mid5", stat("mid5", 7));
      stats.set("mid6", stat("mid6", 3));

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      expect(result.autoSubs).toHaveLength(2);
      const subIds = result.autoSubs.map((s) => s.inId).sort();
      expect(subIds).toContain("def3"); // bench_order 2
      expect(subIds).toContain("mid5"); // bench_order 3
    });
  });

  // ── Bench Boost ────────────────────────────────────────────────────

  describe("bench boost chip", () => {
    it("all 17 players score with bench boost", () => {
      const stats = allPlayedStats(5);
      const squad = fullSquad().map((r) => ({
        ...r,
        active_chip: "bench_boost",
      }));

      const result = computeUserScore(squad, stats, META_MAP);

      // 16 × 5 = 80, captain gk1 × 5 × 2 = 10 → 90
      expect(result.totalPoints).toBe(90);
      expect(result.benchBoost).toBe(true);
    });

    it("bench boost only scores players who have points", () => {
      const stats = allPlayedStats(0);
      stats.set("gk1", stat("gk1", 10));  // captain
      stats.set("mid5", stat("mid5", 8));  // bench player
      stats.set("def4", stat("def4", 3));  // bench player

      const squad = fullSquad().map((r) => ({
        ...r,
        active_chip: "bench_boost",
      }));

      const result = computeUserScore(squad, stats, META_MAP);

      // captain: 10 × 2 = 20, mid5: 8, def4: 3 → 31
      expect(result.totalPoints).toBe(31);
    });

    it("bench boost still uses captain multiplier", () => {
      const stats = allPlayedStats(0);
      stats.set("gk1", stat("gk1", 15)); // captain on bench boost

      const squad = fullSquad().map((r) => ({
        ...r,
        active_chip: "bench_boost",
      }));

      const result = computeUserScore(squad, stats, META_MAP);

      expect(result.totalPoints).toBe(30); // 15 × 2
      expect(result.captainActivated).toBe("captain");
    });

    it("bench boost + vice-captain when captain absent", () => {
      const stats = allPlayedStats(0);
      stats.set("gk1", stat("gk1", 0, false)); // captain out, 0 pts
      stats.set("def1", stat("def1", 6));

      const squad = fullSquad([
        { player_id: "def1", is_vice_captain: true },
      ]).map((r) => ({ ...r, active_chip: "bench_boost" }));

      const result = computeUserScore(squad, stats, META_MAP);

      expect(result.captainActivated).toBe("vice");
      // Bench boost: all 17 score. Only def1 has points: 6 × 2 = 12
      expect(result.totalPoints).toBe(12);
      expect(result.benchBoost).toBe(true);
    });

    it("bench boost + triple captain", () => {
      const stats = allPlayedStats(2);
      const squad = fullSquad().map((r) => ({
        ...r,
        active_chip: "bench_boost", // Note: in practice only one chip active
      }));
      // Override to test: if somehow both are set, bench_boost takes priority
      // for scoring all 17, but triple_captain logic is separate
      const result = computeUserScore(squad, stats, META_MAP);

      // 16 × 2 = 32, captain gk1 × 2 × 2 = 4 → 36
      expect(result.totalPoints).toBe(36);
    });
  });

  // ── Formation constraints in auto-sub ──────────────────────────────

  describe("formation constraints", () => {
    it("won't sub DEF for MID if it breaks formation (DEF goes below 2)", () => {
      const stats = allPlayedStats(5);
      stats.set("def1", stat("def1", 5, false)); // 1 of 2 DEFs out
      stats.set("def2", stat("def2", 5, false)); // other DEF also out
      // Only bench DEFs: def3(order 2), def4(order 7)
      // mid5(order 3) should NOT sub for DEF even though order is lower than def4

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      // Both DEFs need replacing → def3 and def4 should be used
      const subIns = result.autoSubs.map((s) => s.inId);
      // def3 (bench_order 2) should replace first, then def4 (bench_order 7)
      expect(subIns).toContain("def3");
      // For the second DEF, we need another DEF → def4
      expect(subIns).toContain("def4");
    });

    it("formation check at 10 starters prevents invalid sub", () => {
      // Starting: 1GK, 2DEF, 4MID, 2FWD, 1Lady(FWD) = 10
      // If MID is out, bench has: gk2(skip GK), def3(would give 3DEF+3MID → valid?
      // 1GK+3DEF+3MID+2FWD+1Lady = 10 → DEF=3 ✓, MID=3 ✓, FWD=3 ✓ → valid)
      const stats = allPlayedStats(5);
      stats.set("mid1", stat("mid1", 5, false)); // MID out

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      // def3 (bench_order 2) is the first non-GK bench player
      // But subbing DEF for MID → 1GK+3DEF+3MID+3FWD = 10 → valid ✓
      expect(result.autoSubs).toHaveLength(1);
    });

    it("incremental max-check prevents DEF overflow when multiple starters absent", () => {
      // Custom roster: Starting 1GK, 3DEF, 3MID, 3FWD
      // 2 FWDs absent → without max-check, bench DEF could push DEF to 4
      const customMeta = new Map<string, PlayerMeta>([
        ["gk1", meta("gk1", "GK")],
        ["d1", meta("d1", "DEF")],
        ["d2", meta("d2", "DEF")],
        ["d3", meta("d3", "DEF")],
        ["m1", meta("m1", "MID")],
        ["m2", meta("m2", "MID")],
        ["m3", meta("m3", "MID")],
        ["f1", meta("f1", "FWD")],
        ["f2", meta("f2", "FWD")],
        ["lady_f", meta("lady_f", "FWD", true)],
        // Bench
        ["gk2", meta("gk2", "GK")],
        ["d4", meta("d4", "DEF")],     // bench_order 1 — would push DEF to 4 if allowed
        ["m4", meta("m4", "MID")],     // bench_order 2
        ["m5", meta("m5", "MID")],     // bench_order 3
        ["f3", meta("f3", "FWD")],     // bench_order 4
        ["lady_f2", meta("lady_f2", "FWD", true)], // bench_order 5
        ["d5", meta("d5", "DEF")],     // bench_order 6
      ]);

      const customSquad: RosterRow[] = [
        roster("gk1", { is_captain: true, multiplier: 2 }),
        roster("d1"), roster("d2"), roster("d3"),
        roster("m1"), roster("m2"), roster("m3"),
        roster("f1"), roster("f2"),
        roster("lady_f"),
        // Bench
        roster("gk2", { is_starting_9: false, bench_order: 1 }),
        roster("d4", { is_starting_9: false, bench_order: 2 }),
        roster("m4", { is_starting_9: false, bench_order: 3 }),
        roster("m5", { is_starting_9: false, bench_order: 4 }),
        roster("f3", { is_starting_9: false, bench_order: 5 }),
        roster("lady_f2", { is_starting_9: false, bench_order: 6 }),
        roster("d5", { is_starting_9: false, bench_order: 7 }),
      ];

      const stats = new Map<string, PlayerStat>();
      for (const [id] of customMeta) stats.set(id, stat(id, 5));
      // f1 and f2 didn't play
      stats.set("f1", stat("f1", 0, false));
      stats.set("f2", stat("f2", 0, false));

      const result = computeUserScore(customSquad, stats, customMeta);

      // d4 (bench_order 2) is first non-GK bench player, but subbing DEF for FWD
      // would push DEF to 4 (>3 max). Max-check should skip d4 and pick m4 instead.
      const subIns = result.autoSubs.map((s) => s.inId);
      expect(subIns).not.toContain("d4"); // DEF overflow blocked
      expect(subIns).toContain("m4");     // MID is valid (MID ≤ 5)
      expect(result.autoSubs).toHaveLength(2);
    });

    it("incremental max-check still allows position at exactly its max", () => {
      // Starting: 1GK, 2DEF, 4MID, 3FWD. 2 MIDs absent.
      // def3 (DEF) should be allowed as first sub since it pushes DEF to 3 (= max, not over)
      const stats = allPlayedStats(5);
      stats.set("mid1", stat("mid1", 0, false));
      stats.set("mid2", stat("mid2", 0, false));

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      // def3 (bench_order 2) pushes DEF to 3 (at max but not over) → allowed
      // mid5 (bench_order 3) pushes MID to 3 → valid at 10: 1GK+3DEF+3MID+3FWD ✓
      const subIns = result.autoSubs.map((s) => s.inId);
      expect(subIns).toContain("def3");
      expect(subIns).toContain("mid5");
      expect(result.autoSubs).toHaveLength(2);
    });
  });

  // ── Edge cases ─────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("empty roster returns 0 points", () => {
      const result = computeUserScore(
        [roster("p1")],
        new Map([["p1", stat("p1", 0, false)]]),
        new Map([["p1", meta("p1", "MID")]]),
      );

      expect(result.totalPoints).toBe(0);
      expect(result.userId).toBe(USER);
    });

    it("no player stats at all → 0 points, no subs", () => {
      const result = computeUserScore(
        fullSquad(),
        new Map(), // no stats
        META_MAP,
      );

      // No one played → all starters absent → try to sub but bench also has no stats
      expect(result.totalPoints).toBe(0);
      expect(result.captainActivated).toBe("none");
    });

    it("bench with NULL bench_order sorts last", () => {
      const stats = allPlayedStats(5);
      stats.set("mid4", stat("mid4", 5, false)); // MID out

      // Override: remove bench_order from mid5, give mid6 order 1
      const squad = fullSquad([
        { player_id: "mid5", bench_order: null },
        { player_id: "mid6", bench_order: 1 },
      ]);

      const result = computeUserScore(squad, stats, META_MAP);

      expect(result.autoSubs).toHaveLength(1);
      // mid6 has bench_order=1, mid5 has null (sorts to 99) → mid6 first
      expect(result.autoSubs[0].inId).toBe("mid6");
    });

    it("player with did_play=true but 0 points still counts as played", () => {
      const stats = allPlayedStats(5);
      stats.set("mid4", stat("mid4", 0, true)); // played but 0 pts

      const result = computeUserScore(fullSquad(), stats, META_MAP);

      // mid4 played → no auto-sub
      expect(result.autoSubs).toHaveLength(0);
      // captain gk1: 5×2=10, 8 non-captain starters: 8×5=40, mid4: 0 → 50
      expect(result.totalPoints).toBe(50);
    });

    it("captain who is auto-subbed out loses captaincy to vice", () => {
      const stats = allPlayedStats(5);
      stats.set("gk1", stat("gk1", 10, false)); // captain GK out

      const squad = fullSquad([
        { player_id: "def1", is_vice_captain: true },
      ]);

      const result = computeUserScore(squad, stats, META_MAP);

      expect(result.captainActivated).toBe("vice");
      // gk2 subs in for gk1, def1 gets 2x
      // 8 starters × 5 = 40, vice def1 × 5 × 2 = 10, gk2 × 5 = 5 → 55
      expect(result.totalPoints).toBe(55);
      expect(result.autoSubs[0].outId).toBe("gk1");
      expect(result.autoSubs[0].inId).toBe("gk2");
    });

    it("vice-captain who is auto-subbed out doesn't get multiplier", () => {
      const stats = allPlayedStats(5);
      stats.set("gk1", stat("gk1", 5, false));  // captain out
      stats.set("def1", stat("def1", 5, false)); // vice also out

      const squad = fullSquad([
        { player_id: "def1", is_vice_captain: true },
      ]);

      const result = computeUserScore(squad, stats, META_MAP);

      // Both captain and vice are out → no multiplier
      expect(result.captainActivated).toBe("none");
    });
  });
});
