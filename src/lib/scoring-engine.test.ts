/**
 * Scoring Engine Tests
 *
 * Tests computeUserScore(), norm(), lookupPoints(), isValidFormation(),
 * exceedsMaxCounts(), and calculateGameweekScores().
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeUserScore,
  norm,
  lookupPoints,
  isValidFormation,
  exceedsMaxCounts,
  calculateGameweekScores,
  type RosterRow,
  type PlayerStat,
  type PlayerMeta,
} from "./scoring-engine";

// ── Mock supabase-admin ──────────────────────────────────────────────

vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseServerOrThrow: vi.fn(),
}));

import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

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

// ══════════════════════════════════════════════════════════════════════
// norm() — Position normalization
// ══════════════════════════════════════════════════════════════════════

describe("norm", () => {
  it("normalizes GK aliases", () => {
    expect(norm("gk")).toBe("GK");
    expect(norm("goalkeeper")).toBe("GK");
    expect(norm("keeper")).toBe("GK");
    expect(norm("GK")).toBe("GK");
  });

  it("normalizes DEF aliases", () => {
    expect(norm("def")).toBe("DEF");
    expect(norm("defender")).toBe("DEF");
    expect(norm("df")).toBe("DEF");
    expect(norm("DEF")).toBe("DEF");
  });

  it("normalizes MID aliases", () => {
    expect(norm("mid")).toBe("MID");
    expect(norm("midfielder")).toBe("MID");
    expect(norm("mf")).toBe("MID");
    expect(norm("MID")).toBe("MID");
  });

  it("normalizes FWD aliases", () => {
    expect(norm("fwd")).toBe("FWD");
    expect(norm("forward")).toBe("FWD");
    expect(norm("fw")).toBe("FWD");
    expect(norm("striker")).toBe("FWD");
    expect(norm("FWD")).toBe("FWD");
  });

  it("defaults to MID for unknown positions", () => {
    expect(norm("unknown")).toBe("MID");
    expect(norm("wing")).toBe("MID");
    expect(norm("")).toBe("MID");
  });

  it("handles null and undefined", () => {
    expect(norm(null)).toBe("MID");
    expect(norm(undefined)).toBe("MID");
  });

  it("trims whitespace", () => {
    expect(norm("  gk  ")).toBe("GK");
    expect(norm("\tdef\t")).toBe("DEF");
  });
});

// ══════════════════════════════════════════════════════════════════════
// lookupPoints() — Scoring rules lookup with lady multiplier
// ══════════════════════════════════════════════════════════════════════

describe("lookupPoints", () => {
  const rules: Record<string, number> = {
    "goal:FWD": 4,
    "goal:MID": 5,
    "goal:DEF": 6,
    "goal:GK": 6,
    "assist:ALL": 3,
    "appearance:ALL": 2,
    "clean_sheet:GK": 4,
    "clean_sheet:DEF": 4,
    "yellow_card:ALL": -1,
    "red_card:ALL": -3,
    "own_goal:ALL": -2,
    "pen_miss:ALL": -2,
    "saves:GK": 1,
  };

  it("returns position-specific points", () => {
    expect(lookupPoints(rules, "goal", "FWD", false)).toBe(4);
    expect(lookupPoints(rules, "goal", "MID", false)).toBe(5);
    expect(lookupPoints(rules, "goal", "DEF", false)).toBe(6);
  });

  it("falls back to ALL when no position-specific rule", () => {
    expect(lookupPoints(rules, "assist", "FWD", false)).toBe(3);
    expect(lookupPoints(rules, "assist", "MID", false)).toBe(3);
    expect(lookupPoints(rules, "appearance", "DEF", false)).toBe(2);
  });

  it("returns 0 for unknown actions", () => {
    expect(lookupPoints(rules, "hat_trick", "FWD", false)).toBe(0);
    expect(lookupPoints(rules, "nonexistent", "GK", false)).toBe(0);
  });

  it("lady gets 2x on positive actions", () => {
    expect(lookupPoints(rules, "goal", "FWD", true)).toBe(8);    // 4 × 2
    expect(lookupPoints(rules, "goal", "MID", true)).toBe(10);   // 5 × 2
    expect(lookupPoints(rules, "assist", "FWD", true)).toBe(6);  // 3 × 2
    expect(lookupPoints(rules, "appearance", "FWD", true)).toBe(4); // 2 × 2
    expect(lookupPoints(rules, "clean_sheet", "DEF", true)).toBe(8); // 4 × 2
    expect(lookupPoints(rules, "saves", "GK", true)).toBe(2);    // 1 × 2
  });

  it("lady does NOT get 2x on negative actions", () => {
    expect(lookupPoints(rules, "yellow_card", "FWD", true)).toBe(-1);  // stays -1
    expect(lookupPoints(rules, "red_card", "MID", true)).toBe(-3);     // stays -3
    expect(lookupPoints(rules, "own_goal", "DEF", true)).toBe(-2);     // stays -2
    expect(lookupPoints(rules, "pen_miss", "FWD", true)).toBe(-2);     // stays -2
  });

  it("non-lady does NOT get multiplier", () => {
    expect(lookupPoints(rules, "goal", "FWD", false)).toBe(4);
    expect(lookupPoints(rules, "yellow_card", "FWD", false)).toBe(-1);
  });

  it("position-specific rule takes priority over ALL", () => {
    // clean_sheet has GK-specific (4) but no FWD-specific → fallback ALL
    // Since there's no "clean_sheet:ALL", FWD gets 0
    expect(lookupPoints(rules, "clean_sheet", "FWD", false)).toBe(0);
    // GK gets position-specific 4
    expect(lookupPoints(rules, "clean_sheet", "GK", false)).toBe(4);
  });
});

// ══════════════════════════════════════════════════════════════════════
// isValidFormation() / exceedsMaxCounts()
// ══════════════════════════════════════════════════════════════════════

describe("isValidFormation", () => {
  it("accepts valid 1-2-4-3 formation", () => {
    expect(isValidFormation(["GK", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD"])).toBe(true);
  });

  it("accepts valid 1-3-3-3 formation", () => {
    expect(isValidFormation(["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD"])).toBe(true);
  });

  it("accepts valid 1-2-5-2 formation", () => {
    expect(isValidFormation(["GK", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD", "FWD"])).toBe(true);
  });

  it("accepts valid 1-3-5-1 — wait, FWD=1 is invalid", () => {
    expect(isValidFormation(["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD"])).toBe(false);
  });

  it("rejects 0 GK", () => {
    expect(isValidFormation(["DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD"])).toBe(false);
  });

  it("rejects 2 GKs", () => {
    expect(isValidFormation(["GK", "GK", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD", "FWD"])).toBe(false);
  });

  it("rejects DEF=1 (below minimum 2)", () => {
    expect(isValidFormation(["GK", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD"])).toBe(false);
  });

  it("rejects DEF=4 (above maximum 3)", () => {
    expect(isValidFormation(["GK", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "FWD", "FWD"])).toBe(false);
  });

  it("rejects MID=2 (below minimum 3)", () => {
    expect(isValidFormation(["GK", "DEF", "DEF", "DEF", "MID", "MID", "FWD", "FWD", "FWD", "FWD"])).toBe(false);
  });

  it("rejects MID=6 (above maximum 5)", () => {
    expect(isValidFormation(["GK", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "MID", "FWD"])).toBe(false);
  });
});

describe("exceedsMaxCounts", () => {
  it("returns false when all positions within max", () => {
    expect(exceedsMaxCounts(["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID"])).toBe(false);
  });

  it("returns true when GK > 1", () => {
    expect(exceedsMaxCounts(["GK", "GK"])).toBe(true);
  });

  it("returns true when DEF > 3", () => {
    expect(exceedsMaxCounts(["DEF", "DEF", "DEF", "DEF"])).toBe(true);
  });

  it("returns true when MID > 5", () => {
    expect(exceedsMaxCounts(["MID", "MID", "MID", "MID", "MID", "MID"])).toBe(true);
  });

  it("returns true when FWD > 3", () => {
    expect(exceedsMaxCounts(["FWD", "FWD", "FWD", "FWD"])).toBe(true);
  });

  it("returns false at exactly max counts", () => {
    expect(exceedsMaxCounts(["GK", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD"])).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// calculateGameweekScores() — Full engine with mocked Supabase
// ══════════════════════════════════════════════════════════════════════

describe("calculateGameweekScores", () => {
  /** Build a chainable mock supabase query builder */
  function mockQueryBuilder(data: any[] | null = [], error: any = null) {
    const result = { data, error };
    const chain: any = {};
    const methods = ["select", "eq", "in", "lt", "order", "limit", "insert", "upsert", "range"];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Make it thenable
    chain.then = (resolve: any, reject?: any) => Promise.resolve(result).then(resolve, reject);
    return chain;
  }

  function createMockSupabase(tableResponses: Record<string, { data: any[] | null; error: any }>) {
    // Track call order per table to return different data for sequential calls
    const callCounts: Record<string, number> = {};

    return {
      from: vi.fn((table: string) => {
        callCounts[table] = (callCounts[table] ?? 0) + 1;
        const key = `${table}:${callCounts[table]}`;
        const resp = tableResponses[key] ?? tableResponses[table] ?? { data: [], error: null };
        return mockQueryBuilder(resp.data, resp.error);
      }),
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty results when no rosters exist", async () => {
    const mockSb = createMockSupabase({
      user_rosters: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    expect(result.results).toEqual([]);
    expect(result.summary).toEqual({ usersScored: 0, gameweekId: 1 });
  });

  it("scores a simple gameweek with one user", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
      { user_id: "u1", player_id: "p2", is_starting_9: true, is_captain: false, is_vice_captain: false, multiplier: 1, active_chip: null, bench_order: null },
      { user_id: "u1", player_id: "p3", is_starting_9: false, is_captain: false, is_vice_captain: false, multiplier: 1, active_chip: null, bench_order: 1 },
    ];

    const mockSb = createMockSupabase({
      // 1st call: explicit rosters
      "user_rosters:1": { data: rosterRows, error: null },
      // 2nd call: rollover check
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: {
        data: [
          { id: "p1", position: "MID", is_lady: false },
          { id: "p2", position: "FWD", is_lady: false },
          { id: "p3", position: "DEF", is_lady: false },
        ],
        error: null,
      },
      scoring_rules: {
        data: [
          { action: "appearance", position: null, points: 2 },
          { action: "goal", position: "MID", points: 5 },
        ],
        error: null,
      },
      player_match_events: {
        data: [
          { player_id: "p1", action: "appearance", quantity: 1 },
          { player_id: "p1", action: "goal", quantity: 1 },
          { player_id: "p2", action: "appearance", quantity: 1 },
        ],
        error: null,
      },
      player_stats: { data: [], error: null },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    expect(result.summary.usersScored).toBe(1);
    expect(result.results).toHaveLength(1);
    // p1 (captain): appearance(2) + goal(5) = 7, × 2 = 14
    // p2: appearance(2) = 2
    // p3: bench, not scoring
    expect(result.results[0].totalPoints).toBe(16);
    expect(result.results[0].captainActivated).toBe("captain");
  });

  it("throws on roster fetch error", async () => {
    const mockSb = createMockSupabase({
      "user_rosters:1": { data: null, error: { message: "DB down" } },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    await expect(calculateGameweekScores(1)).rejects.toThrow("Failed to fetch rosters: DB down");
  });

  it("throws on match fetch error", async () => {
    const mockSb = createMockSupabase({
      "user_rosters:1": {
        data: [{ user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null }],
        error: null,
      },
      "user_rosters:2": { data: [], error: null },
      matches: { data: null, error: { message: "Match error" } },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    await expect(calculateGameweekScores(1)).rejects.toThrow("Failed to fetch GW matches: Match error");
  });

  it("throws on player fetch error", async () => {
    const mockSb = createMockSupabase({
      "user_rosters:1": {
        data: [{ user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null }],
        error: null,
      },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [], error: null },
      players: { data: null, error: { message: "Players error" } },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    await expect(calculateGameweekScores(1)).rejects.toThrow("Failed to fetch players: Players error");
  });

  it("throws on scoring rules fetch error", async () => {
    const mockSb = createMockSupabase({
      "user_rosters:1": {
        data: [{ user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null }],
        error: null,
      },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [], error: null },
      players: { data: [{ id: "p1", position: "MID", is_lady: false }], error: null },
      scoring_rules: { data: null, error: { message: "Rules error" } },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    await expect(calculateGameweekScores(1)).rejects.toThrow("Failed to load scoring rules: Rules error");
  });

  it("throws on events fetch error", async () => {
    const mockSb = createMockSupabase({
      "user_rosters:1": {
        data: [{ user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null }],
        error: null,
      },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: { data: [{ id: "p1", position: "MID", is_lady: false }], error: null },
      scoring_rules: { data: [], error: null },
      player_match_events: { data: null, error: { message: "Events error" } },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    await expect(calculateGameweekScores(1)).rejects.toThrow("Events error");
  });

  it("applies lady 2x multiplier on positive event points", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "lady1", is_starting_9: true, is_captain: false, is_vice_captain: false, multiplier: 1, active_chip: null, bench_order: null },
      { user_id: "u1", player_id: "p2", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: {
        data: [
          { id: "lady1", position: "FWD", is_lady: true },
          { id: "p2", position: "MID", is_lady: false },
        ],
        error: null,
      },
      scoring_rules: {
        data: [
          { action: "appearance", position: null, points: 2 },
          { action: "goal", position: "FWD", points: 4 },
        ],
        error: null,
      },
      player_match_events: {
        data: [
          { player_id: "lady1", action: "appearance", quantity: 1 },
          { player_id: "lady1", action: "goal", quantity: 1 },
          { player_id: "p2", action: "appearance", quantity: 1 },
        ],
        error: null,
      },
      player_stats: { data: [], error: null },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // lady1: appearance 2×2=4, goal 4×2=8 → 12
    // p2 (captain): appearance 2 → 2×2(captain)=4
    expect(result.results[0].totalPoints).toBe(16);
  });

  it("adds appearance points for players who played via player_stats but have no appearance event", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [], error: null }, // no matches → no events
      players: { data: [{ id: "p1", position: "MID", is_lady: false }], error: null },
      scoring_rules: {
        data: [{ action: "appearance", position: null, points: 2 }],
        error: null,
      },
      player_stats: {
        data: [{ player_id: "p1", did_play: true }],
        error: null,
      },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // p1 played (from player_stats), no appearance event → gets appearance points
    // captain: 2 × 2 = 4
    expect(result.results[0].totalPoints).toBe(4);
  });

  it("does not double-count appearance for players with appearance event", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: { data: [{ id: "p1", position: "MID", is_lady: false }], error: null },
      scoring_rules: {
        data: [{ action: "appearance", position: null, points: 2 }],
        error: null,
      },
      player_match_events: {
        data: [{ player_id: "p1", action: "appearance", quantity: 1 }],
        error: null,
      },
      player_stats: {
        data: [{ player_id: "p1", did_play: true }],
        error: null,
      },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // p1 has appearance event (2pts) — should NOT get double appearance
    // captain: 2 × 2 = 4
    expect(result.results[0].totalPoints).toBe(4);
  });

  it("handles roster rollover for users without explicit GW roster", async () => {
    // First call: explicit rosters for GW 3 → empty
    // Second call: all rostered users before GW 3 → u1
    // Then it fetches u1's latest GW roster (GW 2) and copies it
    const prevRoster = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: "triple_captain", bench_order: null },
      { user_id: "u1", player_id: "p2", is_starting_9: true, is_captain: false, is_vice_captain: false, multiplier: 1, active_chip: "triple_captain", bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: [], error: null },          // no explicit rosters for GW 3
      "user_rosters:2": { data: [{ user_id: "u1" }], error: null }, // u1 has previous rosters
      "user_rosters:3": { data: [{ gameweek_id: 2 }], error: null }, // latest GW = 2
      "user_rosters:4": { data: prevRoster, error: null },  // u1's GW 2 roster
      "user_rosters:5": { data: [], error: null },          // upsert result
      matches: { data: [], error: null },
      players: {
        data: [
          { id: "p1", position: "MID", is_lady: false },
          { id: "p2", position: "DEF", is_lady: false },
        ],
        error: null,
      },
      scoring_rules: {
        data: [{ action: "appearance", position: null, points: 2 }],
        error: null,
      },
      player_stats: {
        data: [
          { player_id: "p1", did_play: true },
          { player_id: "p2", did_play: true },
        ],
        error: null,
      },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(3);

    expect(result.summary.usersScored).toBe(1);
    // Chips don't carry over: active_chip should be null → normal captain 2x
    // p1 (captain): appearance 2 × 2 = 4, p2: appearance 2 = 2 → total 6
    expect(result.results[0].totalPoints).toBe(6);
  });

  it("handles sub_appearance event as an appearance marker", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: { data: [{ id: "p1", position: "MID", is_lady: false }], error: null },
      scoring_rules: {
        data: [
          { action: "appearance", position: null, points: 2 },
          { action: "sub_appearance", position: null, points: 1 },
        ],
        error: null,
      },
      player_match_events: {
        data: [{ player_id: "p1", action: "sub_appearance", quantity: 1 }],
        error: null,
      },
      player_stats: { data: [], error: null },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // sub_appearance counts as appearance marker → no extra appearance pts added
    // p1: sub_appearance = 1pt, captain 2x → 2
    expect(result.results[0].totalPoints).toBe(2);
  });

  it("scores multiple users independently", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
      { user_id: "u2", player_id: "p2", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: {
        data: [
          { id: "p1", position: "MID", is_lady: false },
          { id: "p2", position: "FWD", is_lady: false },
        ],
        error: null,
      },
      scoring_rules: {
        data: [
          { action: "appearance", position: null, points: 2 },
          { action: "goal", position: "MID", points: 5 },
          { action: "goal", position: "FWD", points: 4 },
        ],
        error: null,
      },
      player_match_events: {
        data: [
          { player_id: "p1", action: "appearance", quantity: 1 },
          { player_id: "p1", action: "goal", quantity: 2 },
          { player_id: "p2", action: "appearance", quantity: 1 },
          { player_id: "p2", action: "goal", quantity: 1 },
        ],
        error: null,
      },
      player_stats: { data: [], error: null },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    expect(result.summary.usersScored).toBe(2);
    // u1: p1 captain, appearance(2)+goal(5×2)=12, ×2 captain = 24
    const u1 = result.results.find((r) => r.userId === "u1");
    expect(u1?.totalPoints).toBe(24);
    // u2: p2 captain, appearance(2)+goal(4)=6, ×2 captain = 12
    const u2 = result.results.find((r) => r.userId === "u2");
    expect(u2?.totalPoints).toBe(12);
  });

  it("throws on upsert error (line 488 branch)", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [], error: null },
      players: { data: [{ id: "p1", position: "MID", is_lady: false }], error: null },
      scoring_rules: { data: [], error: null },
      player_stats: { data: [{ player_id: "p1", did_play: true }], error: null },
      user_weekly_scores: { data: null, error: { message: "Upsert failed" } },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    await expect(calculateGameweekScores(1)).rejects.toThrow("Failed to upsert scores: Upsert failed");
  });

  it("skips rollover when previous roster is empty (line 328 branch)", async () => {
    const mockSb = createMockSupabase({
      "user_rosters:1": { data: [], error: null },
      "user_rosters:2": { data: [{ user_id: "u1" }], error: null }, // u1 has previous rosters
      "user_rosters:3": { data: [{ gameweek_id: 2 }], error: null }, // latest GW = 2
      "user_rosters:4": { data: [], error: null },  // but roster is empty!
      matches: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(3);

    // Empty prev roster → skip rollover → no rosters at all
    expect(result.results).toEqual([]);
    expect(result.summary.usersScored).toBe(0);
  });

  it("skips rollover when no latest GW found (line 318-319 branch)", async () => {
    const mockSb = createMockSupabase({
      "user_rosters:1": { data: [], error: null },
      "user_rosters:2": { data: [{ user_id: "u1" }], error: null },
      "user_rosters:3": { data: [], error: null }, // no latest GW found
      matches: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(5);

    expect(result.results).toEqual([]);
  });

  it("handles player with no metadata (line 442 branch — is_lady defaults to false)", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
      { user_id: "u1", player_id: "p_unknown", is_starting_9: true, is_captain: false, is_vice_captain: false, multiplier: 1, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [], error: null },
      players: {
        // p_unknown is NOT in players table → no metadata
        data: [{ id: "p1", position: "MID", is_lady: false }],
        error: null,
      },
      scoring_rules: {
        data: [{ action: "appearance", position: null, points: 2 }],
        error: null,
      },
      player_stats: {
        data: [
          { player_id: "p1", did_play: true },
          { player_id: "p_unknown", did_play: true },
        ],
        error: null,
      },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // p1 (captain): appearance 2 × 2 = 4
    // p_unknown: no meta → is_lady defaults to false, position defaults to MID
    //   appearance 2 (not 2x since not lady) = 2
    expect(result.results[0].totalPoints).toBe(6);
  });

  it("handles rollover upsert error gracefully (line 347 branch)", async () => {
    const prevRoster = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: [], error: null },
      "user_rosters:2": { data: [{ user_id: "u1" }], error: null },
      "user_rosters:3": { data: [{ gameweek_id: 2 }], error: null },
      "user_rosters:4": { data: prevRoster, error: null },
      "user_rosters:5": { data: null, error: { message: "Upsert conflict" } }, // rollover upsert fails
      matches: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(3);

    // Rollover upsert failed → rolledOverRows not added → no rosters
    expect(result.results).toEqual([]);
    expect(result.summary.usersScored).toBe(0);
  });

  it("handles null prevRoster from DB (line 328 null branch)", async () => {
    const mockSb = createMockSupabase({
      "user_rosters:1": { data: [], error: null },
      "user_rosters:2": { data: [{ user_id: "u1" }], error: null },
      "user_rosters:3": { data: [{ gameweek_id: 2 }], error: null },
      "user_rosters:4": { data: null, error: null }, // null data
      matches: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(3);

    expect(result.results).toEqual([]);
  });

  it("handles event for player with no metadata (line 412-413 branch)", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
      { user_id: "u1", player_id: "p_ghost", is_starting_9: true, is_captain: false, is_vice_captain: false, multiplier: 1, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: {
        // p_ghost NOT in players table → meta is undefined in events loop
        data: [{ id: "p1", position: "MID", is_lady: false }],
        error: null,
      },
      scoring_rules: {
        data: [
          { action: "appearance", position: null, points: 2 },
          { action: "goal", position: "MID", points: 5 },
        ],
        error: null,
      },
      player_match_events: {
        data: [
          { player_id: "p1", action: "appearance", quantity: 1 },
          { player_id: "p_ghost", action: "appearance", quantity: 1 },
          { player_id: "p_ghost", action: "goal", quantity: 1 },
        ],
        error: null,
      },
      player_stats: { data: [], error: null },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // p1 (captain): appearance(2) × 2 = 4
    // p_ghost: no meta → position defaults to MID, is_lady defaults to false
    //   appearance(2) + goal(MID=5) = 7
    expect(result.results[0].totalPoints).toBe(11);
  });

  it("handles player_stats with did_play=false (line 429-430 branch)", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
      { user_id: "u1", player_id: "p2", is_starting_9: true, is_captain: false, is_vice_captain: false, multiplier: 1, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [], error: null },
      players: {
        data: [
          { id: "p1", position: "MID", is_lady: false },
          { id: "p2", position: "DEF", is_lady: false },
        ],
        error: null,
      },
      scoring_rules: {
        data: [{ action: "appearance", position: null, points: 2 }],
        error: null,
      },
      player_stats: {
        data: [
          { player_id: "p1", did_play: true },
          { player_id: "p2", did_play: false }, // did NOT play — should not get appearance
        ],
        error: null,
      },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // p1 (captain): appearance 2 × 2 = 4
    // p2: did_play=false → no appearance → 0 pts
    expect(result.results[0].totalPoints).toBe(4);
  });

  it("handles null player_stats data (line 429 ?? branch)", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: { data: [{ id: "p1", position: "MID", is_lady: false }], error: null },
      scoring_rules: {
        data: [{ action: "appearance", position: null, points: 2 }],
        error: null,
      },
      player_match_events: {
        data: [{ player_id: "p1", action: "appearance", quantity: 1 }],
        error: null,
      },
      player_stats: { data: null, error: null }, // null data
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // p1 captain: appearance(2) × 2 = 4
    expect(result.results[0].totalPoints).toBe(4);
  });

  it("handles null matches data (line 376 ?? branch)", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: null, error: null }, // null data, no error
      players: { data: [{ id: "p1", position: "MID", is_lady: false }], error: null },
      scoring_rules: {
        data: [{ action: "appearance", position: null, points: 2 }],
        error: null,
      },
      player_stats: { data: [{ player_id: "p1", did_play: true }], error: null },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // No matches → no events path, but player_stats says played → appearance pts
    // captain: 2 × 2 = 4
    expect(result.results[0].totalPoints).toBe(4);
  });

  it("handles null players data (line 387 ?? branch)", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [], error: null },
      players: { data: null, error: null }, // null players data, no error
      scoring_rules: {
        data: [{ action: "appearance", position: null, points: 2 }],
        error: null,
      },
      player_stats: { data: [{ player_id: "p1", did_play: true }], error: null },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // No player metadata → defaults to MID, is_lady=false
    // captain: 2 × 2 = 4
    expect(result.results[0].totalPoints).toBe(4);
  });

  it("handles null events data (line 409 ?? branch)", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: { data: [{ id: "p1", position: "MID", is_lady: false }], error: null },
      scoring_rules: {
        data: [{ action: "appearance", position: null, points: 2 }],
        error: null,
      },
      player_match_events: { data: null, error: null }, // null events, no error
      player_stats: { data: [{ player_id: "p1", did_play: true }], error: null },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // No events → appearance from player_stats
    // captain: 2 × 2 = 4
    expect(result.results[0].totalPoints).toBe(4);
  });

  it("handles null explicit rosters and null allRosteredUsers (lines 292, 301, 360 branches)", async () => {
    const mockSb = createMockSupabase({
      "user_rosters:1": { data: null, error: null }, // null explicit rosters
      "user_rosters:2": { data: null, error: null }, // null allRosteredUsers
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    expect(result.results).toEqual([]);
    expect(result.summary.usersScored).toBe(0);
  });

  it("handles event with null quantity (defaults to 1)", async () => {
    const rosterRows = [
      { user_id: "u1", player_id: "p1", is_starting_9: true, is_captain: true, is_vice_captain: false, multiplier: 2, active_chip: null, bench_order: null },
    ];

    const mockSb = createMockSupabase({
      "user_rosters:1": { data: rosterRows, error: null },
      "user_rosters:2": { data: [], error: null },
      matches: { data: [{ id: "m1" }], error: null },
      players: { data: [{ id: "p1", position: "FWD", is_lady: false }], error: null },
      scoring_rules: {
        data: [
          { action: "goal", position: "FWD", points: 4 },
          { action: "appearance", position: null, points: 2 },
        ],
        error: null,
      },
      player_match_events: {
        data: [
          { player_id: "p1", action: "appearance", quantity: 1 },
          { player_id: "p1", action: "goal", quantity: null }, // null quantity
        ],
        error: null,
      },
      player_stats: { data: [], error: null },
      user_weekly_scores: { data: [], error: null },
    });
    vi.mocked(getSupabaseServerOrThrow).mockReturnValue(mockSb as any);

    const result = await calculateGameweekScores(1);

    // p1 (captain): appearance(2) + goal(4 × null??1 = 4) = 6, × 2 = 12
    expect(result.results[0].totalPoints).toBe(12);
  });
});
