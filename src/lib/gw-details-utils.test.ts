import {
  computeTransferCost,
  computeLeagueStats,
  stripChipsForRollover,
} from "./gw-details-utils";

// ═══════════════════════════════════════════════════════════════════════
// 1. computeTransferCost
// ═══════════════════════════════════════════════════════════════════════

describe("computeTransferCost", () => {
  it("returns 0 when used <= free", () => {
    expect(computeTransferCost(2, 1, false)).toBe(0);
    expect(computeTransferCost(2, 2, false)).toBe(0);
    expect(computeTransferCost(1, 0, false)).toBe(0);
  });

  it("charges 4 pts per extra transfer", () => {
    expect(computeTransferCost(1, 2, false)).toBe(4);
    expect(computeTransferCost(1, 3, false)).toBe(8);
    expect(computeTransferCost(0, 1, false)).toBe(4);
    expect(computeTransferCost(0, 5, false)).toBe(20);
  });

  it("returns 0 when wildcard or free hit is active (unlimited transfers)", () => {
    expect(computeTransferCost(1, 10, true)).toBe(0);
    expect(computeTransferCost(0, 5, true)).toBe(0);
  });

  it("handles zero transfers", () => {
    expect(computeTransferCost(0, 0, false)).toBe(0);
  });

  it("handles large transfer counts", () => {
    expect(computeTransferCost(2, 12, false)).toBe(40);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. computeLeagueStats
// ═══════════════════════════════════════════════════════════════════════

describe("computeLeagueStats", () => {
  it("returns null for empty entries", () => {
    expect(computeLeagueStats([], 50, false)).toBeNull();
  });

  it("computes average, highest, rank, totalManagers for a normal GW", () => {
    const entries = [
      { uid: "a", pts: 60 },
      { uid: "b", pts: 80 },
      { uid: "c", pts: 40 },
    ];
    const result = computeLeagueStats(entries, 80, false);
    expect(result).not.toBeNull();
    expect(result!.averagePoints).toBe(60); // (60+80+40)/3 = 60
    expect(result!.highestPoints).toBe(80);
    expect(result!.totalManagers).toBe(3);
    expect(result!.highestUserId).toBe("b");
    expect(result!.gwRank).toBe(1); // 80 is rank 1
  });

  it("rounds average to nearest integer", () => {
    const entries = [
      { uid: "a", pts: 10 },
      { uid: "b", pts: 20 },
      { uid: "c", pts: 30 },
    ];
    // avg = 20 exactly
    expect(computeLeagueStats(entries, 10, false)!.averagePoints).toBe(20);

    const entries2 = [
      { uid: "a", pts: 10 },
      { uid: "b", pts: 11 },
    ];
    // avg = 10.5 → rounds to 11
    expect(computeLeagueStats(entries2, 10, false)!.averagePoints).toBe(11);
  });

  it("returns correct rank for middle-of-pack user", () => {
    const entries = [
      { uid: "a", pts: 100 },
      { uid: "b", pts: 70 },
      { uid: "c", pts: 50 },
    ];
    const result = computeLeagueStats(entries, 70, false);
    expect(result!.gwRank).toBe(2);
  });

  it("returns correct rank for last-place user", () => {
    const entries = [
      { uid: "a", pts: 100 },
      { uid: "b", pts: 80 },
      { uid: "c", pts: 30 },
    ];
    const result = computeLeagueStats(entries, 30, false);
    expect(result!.gwRank).toBe(3);
  });

  it("handles tied scores (dense rank — no gaps)", () => {
    const entries = [
      { uid: "a", pts: 80 },
      { uid: "b", pts: 80 },
      { uid: "c", pts: 60 },
    ];
    // 80, 80, 60 → dense ranks: 1, 1, 2
    expect(computeLeagueStats(entries, 80, false)!.gwRank).toBe(1);
    expect(computeLeagueStats(entries, 60, false)!.gwRank).toBe(2);
  });

  it("suppresses rank for backfilled GWs", () => {
    const entries = [
      { uid: "a", pts: 60 },
      { uid: "b", pts: 80 },
    ];
    const result = computeLeagueStats(entries, 80, true);
    expect(result!.gwRank).toBeNull();
    // Other stats still computed
    expect(result!.averagePoints).toBe(70);
    expect(result!.highestPoints).toBe(80);
    expect(result!.totalManagers).toBe(2);
    expect(result!.highestUserId).toBe("b");
  });

  it("handles single manager", () => {
    const entries = [{ uid: "solo", pts: 45 }];
    const result = computeLeagueStats(entries, 45, false);
    expect(result!.averagePoints).toBe(45);
    expect(result!.highestPoints).toBe(45);
    expect(result!.totalManagers).toBe(1);
    expect(result!.highestUserId).toBe("solo");
    expect(result!.gwRank).toBe(1);
  });

  it("handles all zeros", () => {
    const entries = [
      { uid: "a", pts: 0 },
      { uid: "b", pts: 0 },
    ];
    const result = computeLeagueStats(entries, 0, false);
    expect(result!.averagePoints).toBe(0);
    expect(result!.highestPoints).toBe(0);
    expect(result!.gwRank).toBe(1); // tied at 0, dense rank 1
  });

  it("picks first user on tie for highestUserId (stable)", () => {
    // reduce picks the first "b.pts > a.pts" winner, so first max stays
    const entries = [
      { uid: "first", pts: 90 },
      { uid: "second", pts: 90 },
    ];
    const result = computeLeagueStats(entries, 90, false);
    expect(result!.highestUserId).toBe("first");
  });

  it("ranks user below the pool correctly", () => {
    const entries = [
      { uid: "a", pts: 100 },
      { uid: "b", pts: 80 },
    ];
    // User scored 50 but is in the entries — rank should be 3 (below all distinct)
    const result = computeLeagueStats(entries, 50, false);
    expect(result!.gwRank).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. stripChipsForRollover
// ═══════════════════════════════════════════════════════════════════════

describe("stripChipsForRollover", () => {
  it("clears active_chip from all rows", () => {
    const rows = [
      { is_captain: false, multiplier: 1, active_chip: "bench_boost", player_id: "p1" },
      { is_captain: true, multiplier: 3, active_chip: "triple_captain", player_id: "p2" },
    ];
    const result = stripChipsForRollover(rows);
    expect(result[0].active_chip).toBeNull();
    expect(result[1].active_chip).toBeNull();
  });

  it("resets captain multiplier to 2 (from triple captain 3)", () => {
    const rows = [
      { is_captain: true, multiplier: 3, active_chip: "triple_captain" },
    ];
    const result = stripChipsForRollover(rows);
    expect(result[0].multiplier).toBe(2);
  });

  it("resets non-captain multiplier to 1", () => {
    const rows = [
      { is_captain: false, multiplier: 1, active_chip: null },
    ];
    const result = stripChipsForRollover(rows);
    expect(result[0].multiplier).toBe(1);
  });

  it("preserves all other row properties", () => {
    const rows = [
      {
        is_captain: false,
        multiplier: 1,
        active_chip: "wildcard",
        player_id: "p1",
        is_starting_9: true,
        is_vice_captain: false,
        bench_order: 3,
      },
    ];
    const result = stripChipsForRollover(rows);
    expect(result[0].player_id).toBe("p1");
    expect(result[0].is_starting_9).toBe(true);
    expect(result[0].is_vice_captain).toBe(false);
    expect(result[0].bench_order).toBe(3);
  });

  it("does not mutate the original rows", () => {
    const rows = [
      { is_captain: true, multiplier: 3, active_chip: "triple_captain" },
    ];
    const result = stripChipsForRollover(rows);
    // Original untouched
    expect(rows[0].multiplier).toBe(3);
    expect(rows[0].active_chip).toBe("triple_captain");
    // New row changed
    expect(result[0].multiplier).toBe(2);
    expect(result[0].active_chip).toBeNull();
  });

  it("handles empty array", () => {
    expect(stripChipsForRollover([])).toEqual([]);
  });

  it("handles mixed squad (bench boost + normal players)", () => {
    const rows = [
      { is_captain: true, multiplier: 2, active_chip: "bench_boost", player_id: "c" },
      { is_captain: false, multiplier: 1, active_chip: "bench_boost", player_id: "s1" },
      { is_captain: false, multiplier: 1, active_chip: "bench_boost", player_id: "s2" },
    ];
    const result = stripChipsForRollover(rows);
    // All chips cleared
    expect(result.every((r) => r.active_chip === null)).toBe(true);
    // Captain stays at 2, others at 1
    expect(result[0].multiplier).toBe(2);
    expect(result[1].multiplier).toBe(1);
    expect(result[2].multiplier).toBe(1);
  });

  it("handles free hit rollover (chip cleared, multipliers reset)", () => {
    const rows = [
      { is_captain: true, multiplier: 2, active_chip: "free_hit" },
      { is_captain: false, multiplier: 1, active_chip: "free_hit" },
    ];
    const result = stripChipsForRollover(rows);
    expect(result[0].active_chip).toBeNull();
    expect(result[1].active_chip).toBeNull();
    expect(result[0].multiplier).toBe(2);
    expect(result[1].multiplier).toBe(1);
  });
});
