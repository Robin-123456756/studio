/**
 * Tests for validateSquadComposition() in roster-validation.ts
 */

import { describe, it, expect } from "vitest";
import { validateSquadComposition } from "./roster-validation";

// ── Test Helpers ──────────────────────────────────────────────────────

type Player = {
  id: string;
  position: string | null;
  is_lady: boolean | null;
  team_id: string | null;
  now_cost: number | null;
};

let idCounter = 0;
function makePlayer(
  position: string,
  teamId: string,
  overrides: Partial<Player> = {},
): Player {
  idCounter++;
  return {
    id: `p${idCounter}`,
    position,
    is_lady: false,
    team_id: teamId,
    now_cost: 5,
    ...overrides,
  };
}

/**
 * Build a valid 17-player squad with a valid 10-player starting lineup.
 * Formation: 1 GK, 3 DEF, 4 MID, 2 FWD (1 lady) starting.
 * Bench: 1 GK, 1 DEF, 1 MID, 2 FWD (1 lady).
 * Spreads players across 6 teams (max 3 per team).
 */
function buildValidSquad() {
  idCounter = 0;

  // Starting 10
  const gk1 = makePlayer("GK", "t1");
  const def1 = makePlayer("DEF", "t1");
  const def2 = makePlayer("DEF", "t2");
  const def3 = makePlayer("DEF", "t3");
  const mid1 = makePlayer("MID", "t1");
  const mid2 = makePlayer("MID", "t2");
  const mid3 = makePlayer("MID", "t3");
  const mid4 = makePlayer("MID", "t4");
  const fwd1 = makePlayer("FWD", "t5");
  const ladyFwd1 = makePlayer("FWD", "t6", { is_lady: true });

  // Bench 7
  const gk2 = makePlayer("GK", "t4");
  const def4 = makePlayer("DEF", "t5");
  const mid5 = makePlayer("MID", "t6");
  const mid6 = makePlayer("MID", "t2");
  const mid7 = makePlayer("MID", "t4");
  const fwd2 = makePlayer("FWD", "t3");
  const ladyFwd2 = makePlayer("FWD", "t5", { is_lady: true });

  const players = [
    gk1, def1, def2, def3, mid1, mid2, mid3, mid4, fwd1, ladyFwd1,
    gk2, def4, mid5, mid6, mid7, fwd2, ladyFwd2,
  ];

  const startingIds = [
    gk1.id, def1.id, def2.id, def3.id,
    mid1.id, mid2.id, mid3.id, mid4.id,
    fwd1.id, ladyFwd1.id,
  ];

  const captainId = mid1.id;
  const viceId = mid2.id;

  return { players, startingIds, captainId, viceId };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("validateSquadComposition", () => {
  // ── Happy path ──

  it("returns null for a valid squad", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    expect(
      validateSquadComposition(players, startingIds, captainId, viceId),
    ).toBeNull();
  });

  // ── Full squad checks ──

  it("rejects squad with fewer than 17 players", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    const result = validateSquadComposition(
      players.slice(0, 16),
      startingIds,
      captainId,
      viceId,
    );
    expect(result).toMatch(/17 players/);
  });

  it("rejects squad with more than 17 players", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    const extra = makePlayer("MID", "t6");
    const result = validateSquadComposition(
      [...players, extra],
      startingIds,
      captainId,
      viceId,
    );
    expect(result).toMatch(/17 players/);
  });

  it("rejects squad without exactly 2 GKs", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Replace bench GK (index 10) with a MID
    const modified = [...players];
    modified[10] = makePlayer("MID", "t4");
    const result = validateSquadComposition(
      modified,
      startingIds,
      captainId,
      viceId,
    );
    expect(result).toMatch(/2 goalkeepers/);
  });

  it("rejects squad without exactly 2 lady forwards", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Remove lady flag from bench lady forward (index 16)
    const modified = [...players];
    modified[16] = { ...modified[16], is_lady: false };
    const result = validateSquadComposition(
      modified,
      startingIds,
      captainId,
      viceId,
    );
    expect(result).toMatch(/2 lady forwards/);
  });

  it("rejects squad with more than 3 players from one team", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Make 4 players from team t1 by changing bench player's team
    const modified = [...players];
    modified[11] = { ...modified[11], team_id: "t1" }; // def4 → t1
    // Now t1 has: gk1, def1, mid1, def4 = 4
    const result = validateSquadComposition(
      modified,
      startingIds,
      captainId,
      viceId,
    );
    expect(result).toMatch(/Max 3 players per team/);
  });

  it("uses team name fallback when team_id is null", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Set team_id to null but provide teams relation — should still group by name
    const modified = players.map((p) => ({
      ...p,
      team_id: null,
      teams: { name: p.team_id, short_name: p.team_id },
    }));
    const result = validateSquadComposition(
      modified,
      startingIds,
      captainId,
      viceId,
    );
    expect(result).toBeNull();
  });

  it("rejects lady non-forward in starting lineup", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Mark a starting MID as lady → should trigger "lady non-forward" error
    const modified = [...players];
    modified[4] = { ...modified[4], is_lady: true }; // mid1 becomes lady
    const result = validateSquadComposition(
      modified,
      startingIds,
      captainId,
      viceId,
    );
    expect(result).toMatch(/lady non-forward/);
  });

  // ── Starting 10 checks ──

  it("rejects starting lineup with fewer than 10", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    const result = validateSquadComposition(
      players,
      startingIds.slice(0, 9),
      captainId,
      viceId,
    );
    expect(result).toMatch(/10 starting players/);
  });

  it("rejects starting lineup with more than 10", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Add a bench player to starting
    const result = validateSquadComposition(
      players,
      [...startingIds, players[11].id],
      captainId,
      viceId,
    );
    expect(result).toMatch(/10 starting players/);
  });

  it("rejects starting player not in squad", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    const modified = [...startingIds];
    modified[8] = "ghost-player"; // replace a real starter with unknown ID
    const result = validateSquadComposition(
      players,
      modified,
      captainId,
      viceId,
    );
    expect(result).toMatch(/not in the squad/);
  });

  it("rejects starting lineup without exactly 1 GK", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Swap starting GK (index 0) with bench GK (index 10) replaced position
    // Actually: replace GK in starting with bench MID, and put GK on bench
    const modified = [...startingIds];
    modified[0] = players[12].id; // mid5 replaces gk1 in starting
    const result = validateSquadComposition(
      players,
      modified,
      captainId,
      viceId,
    );
    // Now starting has 0 GK and 5 MID
    expect(result).toMatch(/1 goalkeeper/);
  });

  it("rejects starting DEF count outside 2-3 range", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Replace def3 (index 3) with bench mid5 (index 12) → only 2 DEF → still valid
    // Replace def2 (index 2) as well → only 1 DEF → invalid
    const modified = [...startingIds];
    modified[2] = players[12].id; // mid5 replaces def2
    modified[3] = players[13].id; // mid6 replaces def3
    // Now: 1 GK, 1 DEF, 6 MID, 2 FWD
    const result = validateSquadComposition(
      players,
      modified,
      captainId,
      viceId,
    );
    expect(result).toMatch(/2-3 defenders/);
  });

  it("rejects starting MID count outside 3-5 range (too few → cascading formation error)", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Swap mid2 (index 5) for bench fwd2 (index 15) → 1 GK, 3 DEF, 3 MID, 3 FWD
    // Then swap mid3 (index 6) for bench def4 (index 11) → 1 GK, 4 DEF, 2 MID, 3 FWD
    // DEF=4 fires first (max 3), proving the formation checks catch violations.
    // It's impossible to isolate a pure MID error without triggering DEF or FWD
    // first (10 starters constrain the distribution), so we verify the cascade.
    const swapped = [...startingIds];
    swapped[5] = players[15].id; // fwd2 replaces mid2
    swapped[6] = players[11].id; // def4 replaces mid3
    const result = validateSquadComposition(
      players,
      swapped,
      captainId,
      viceId,
    );
    expect(result).not.toBeNull();
    expect(result).toMatch(/defenders/);
  });

  it("rejects starting FWD count outside 2-3 range", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Swap fwd1 (index 8) with bench mid5 (index 12) → 3 DEF, 5 MID, 1 FWD
    const modified = [...startingIds];
    modified[8] = players[12].id; // mid5 replaces fwd1
    // Now: 1 GK, 3 DEF, 5 MID, 1 FWD (only lady fwd starting)
    const result = validateSquadComposition(
      players,
      modified,
      captainId,
      viceId,
    );
    expect(result).toMatch(/2-3 forwards/);
  });

  // ── Lady rules for starting 10 ──

  it("rejects starting lineup without exactly 1 lady forward", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Replace starting lady fwd (index 9) with bench non-lady fwd (index 15)
    const modified = [...startingIds];
    modified[9] = players[15].id; // fwd2 (non-lady) replaces ladyFwd1
    const result = validateSquadComposition(
      players,
      modified,
      captainId,
      viceId,
    );
    expect(result).toMatch(/1 lady forward/);
  });

  it("rejects starting lineup with 2 lady forwards", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Replace non-lady fwd1 (index 8) with bench lady fwd2 (index 16)
    const modified = [...startingIds];
    modified[8] = players[16].id; // ladyFwd2 replaces fwd1
    const result = validateSquadComposition(
      players,
      modified,
      captainId,
      viceId,
    );
    expect(result).toMatch(/1 lady forward/);
  });

  // ── Captain / Vice-captain checks ──

  it("rejects missing captain", () => {
    const { players, startingIds, viceId } = buildValidSquad();
    const result = validateSquadComposition(players, startingIds, null, viceId);
    expect(result).toMatch(/Captain is required/);
  });

  it("rejects missing vice-captain", () => {
    const { players, startingIds, captainId } = buildValidSquad();
    const result = validateSquadComposition(
      players,
      startingIds,
      captainId,
      null,
    );
    expect(result).toMatch(/Vice-captain is required/);
  });

  it("rejects captain === vice-captain", () => {
    const { players, startingIds, captainId } = buildValidSquad();
    const result = validateSquadComposition(
      players,
      startingIds,
      captainId,
      captainId,
    );
    expect(result).toMatch(/must be different/);
  });

  it("rejects captain not in starting 10", () => {
    const { players, startingIds, viceId } = buildValidSquad();
    // Use a bench player as captain
    const result = validateSquadComposition(
      players,
      startingIds,
      players[11].id, // bench player
      viceId,
    );
    expect(result).toMatch(/Captain must be in the starting/);
  });

  it("rejects vice-captain not in starting 10", () => {
    const { players, startingIds, captainId } = buildValidSquad();
    const result = validateSquadComposition(
      players,
      startingIds,
      captainId,
      players[11].id, // bench player
    );
    expect(result).toMatch(/Vice-captain must be in the starting/);
  });

  // ── Position normalization edge cases ──

  it("accepts alternative position names (goalkeeper, defender, etc.)", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Change position strings to alternative forms
    const modified = [...players];
    modified[0] = { ...modified[0], position: "goalkeeper" };  // starting GK
    modified[1] = { ...modified[1], position: "defender" };    // starting DEF
    modified[4] = { ...modified[4], position: "midfielder" };  // starting MID
    modified[8] = { ...modified[8], position: "forward" };     // starting FWD
    modified[10] = { ...modified[10], position: "keeper" };    // bench GK
    const result = validateSquadComposition(
      modified,
      startingIds,
      captainId,
      viceId,
    );
    expect(result).toBeNull();
  });

  it("treats null/empty position as MID", () => {
    const { players, startingIds, captainId, viceId } = buildValidSquad();
    // Change one MID to null position — should still count as MID
    const modified = [...players];
    modified[4] = { ...modified[4], position: null };
    const result = validateSquadComposition(
      modified,
      startingIds,
      captainId,
      viceId,
    );
    expect(result).toBeNull();
  });
});

// ── Helper: build a custom starting 10 for isolated formation tests ──

function buildCustomStarting(formation: {
  GK: number;
  DEF: number;
  MID: number;
  FWD: number;
}) {
  idCounter = 100;
  const players: Player[] = [];
  const startingIds: string[] = [];

  // Build starting players per formation
  for (let i = 0; i < formation.GK; i++) {
    const p = makePlayer("GK", `t${i + 1}`);
    players.push(p);
    startingIds.push(p.id);
  }
  for (let i = 0; i < formation.DEF; i++) {
    const p = makePlayer("DEF", `t${(i % 6) + 1}`);
    players.push(p);
    startingIds.push(p.id);
  }
  let ladyAdded = false;
  for (let i = 0; i < formation.MID; i++) {
    const p = makePlayer("MID", `t${(i % 6) + 1}`);
    players.push(p);
    startingIds.push(p.id);
  }
  for (let i = 0; i < formation.FWD; i++) {
    const isLady = !ladyAdded;
    const p = makePlayer("FWD", `t${(i % 6) + 1}`, {
      is_lady: isLady,
    });
    if (isLady) ladyAdded = true;
    players.push(p);
    startingIds.push(p.id);
  }

  // Pad to 17 with bench — need 2 GK total, 2 lady FWD total
  const total = formation.GK + formation.DEF + formation.MID + formation.FWD;
  const benchNeeded = 17 - total;
  // Add bench GK if only 1 in starting
  if (formation.GK < 2) {
    const p = makePlayer("GK", "t6");
    players.push(p);
  }
  // Add bench lady FWD if only 1
  if (!ladyAdded) {
    const p = makePlayer("FWD", "t6", { is_lady: true });
    players.push(p);
  }
  const p2 = makePlayer("FWD", "t5", { is_lady: true });
  players.push(p2);

  // Fill rest with MIDs
  while (players.length < 17) {
    const p = makePlayer("MID", `t${(players.length % 6) + 1}`);
    players.push(p);
  }

  const captainId = startingIds[startingIds.length - 1];
  const viceId = startingIds[startingIds.length - 2] ?? startingIds[0];

  const result = validateSquadComposition(
    players,
    startingIds,
    captainId,
    viceId,
  );
  return { players, startingIds, captainId, viceId, result };
}
