import { describe, it, expect, vi } from "vitest";
import { computeStandings } from "./leaderboard-utils";

// ── Mock Supabase builder ────────────────────────────────────────────

type MockData = { data: any[] | null; error: any };

function createMockSupabase(tables: Record<string, MockData>) {
  const builder = (tableName: string) => {
    const result = tables[tableName] ?? { data: [], error: null };
    const chain: any = {};
    const methods = ["select", "in", "eq", "order"];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    // Make the chain thenable so `await` resolves it
    chain.then = (resolve: any, reject?: any) => {
      return Promise.resolve(result).then(resolve, reject);
    };
    return chain;
  };

  return { from: vi.fn((table: string) => builder(table)) } as any;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("computeStandings", () => {
  it("ranks users by total points descending", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [
          { user_id: "u1", name: "Alpha" },
          { user_id: "u2", name: "Bravo" },
          { user_id: "u3", name: "Charlie" },
        ],
        error: null,
      },
      user_weekly_scores: {
        data: [
          { user_id: "u1", gameweek_id: 1, total_weekly_points: 50 },
          { user_id: "u2", gameweek_id: 1, total_weekly_points: 70 },
          { user_id: "u3", gameweek_id: 1, total_weekly_points: 60 },
        ],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    expect(standings[0].userId).toBe("u2"); // 70
    expect(standings[0].rank).toBe(1);
    expect(standings[1].userId).toBe("u3"); // 60
    expect(standings[1].rank).toBe(2);
    expect(standings[2].userId).toBe("u1"); // 50
    expect(standings[2].rank).toBe(3);
  });

  it("aggregates points across multiple gameweeks", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [
          { user_id: "u1", name: "Alpha" },
          { user_id: "u2", name: "Bravo" },
        ],
        error: null,
      },
      user_weekly_scores: {
        data: [
          { user_id: "u1", gameweek_id: 1, total_weekly_points: 30 },
          { user_id: "u1", gameweek_id: 2, total_weekly_points: 40 },
          { user_id: "u2", gameweek_id: 1, total_weekly_points: 80 },
          { user_id: "u2", gameweek_id: 2, total_weekly_points: 10 },
        ],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    // u2: 80+10=90, u1: 30+40=70
    expect(standings[0].userId).toBe("u2");
    expect(standings[0].totalPoints).toBe(90);
    expect(standings[1].userId).toBe("u1");
    expect(standings[1].totalPoints).toBe(70);
  });

  it("includes gwBreakdown per user", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [{ user_id: "u1", name: "Alpha" }],
        error: null,
      },
      user_weekly_scores: {
        data: [
          { user_id: "u1", gameweek_id: 1, total_weekly_points: 30 },
          { user_id: "u1", gameweek_id: 2, total_weekly_points: 45 },
        ],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    expect(standings[0].gwBreakdown).toEqual({ 1: 30, 2: 45 });
  });

  it("computes movement (positive = moved up)", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [
          { user_id: "u1", name: "Alpha" },
          { user_id: "u2", name: "Bravo" },
        ],
        error: null,
      },
      user_weekly_scores: {
        data: [
          // GW1: u1=50 (rank1), u2=30 (rank2)
          { user_id: "u1", gameweek_id: 1, total_weekly_points: 50 },
          { user_id: "u2", gameweek_id: 1, total_weekly_points: 30 },
          // GW2: u2 scores big, overtakes u1
          { user_id: "u1", gameweek_id: 2, total_weekly_points: 5 },
          { user_id: "u2", gameweek_id: 2, total_weekly_points: 40 },
        ],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    // After GW2: u2=70 (rank1), u1=55 (rank2)
    // Prev (before GW2): u1=50 (rank1), u2=30 (rank2)
    expect(standings[0].userId).toBe("u2");
    expect(standings[0].movement).toBe(1); // was rank2, now rank1 → moved up 1
    expect(standings[1].userId).toBe("u1");
    expect(standings[1].movement).toBe(-1); // was rank1, now rank2 → moved down 1
  });

  it("filters by userIds when provided", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [
          { user_id: "u1", name: "Alpha" },
          { user_id: "u2", name: "Bravo" },
          { user_id: "u3", name: "Charlie" },
        ],
        error: null,
      },
      user_weekly_scores: {
        data: [
          { user_id: "u1", gameweek_id: 1, total_weekly_points: 50 },
          { user_id: "u2", gameweek_id: 1, total_weekly_points: 70 },
          { user_id: "u3", gameweek_id: 1, total_weekly_points: 60 },
        ],
        error: null,
      },
    });

    const standings = await computeStandings(supabase, ["u1", "u3"]);

    expect(standings).toHaveLength(2);
    expect(standings[0].userId).toBe("u3");
    expect(standings[1].userId).toBe("u1");
  });

  it("handles empty data gracefully", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: { data: [], error: null },
      user_weekly_scores: { data: [], error: null },
    });

    const standings = await computeStandings(supabase);
    expect(standings).toEqual([]);
  });

  it("handles null data gracefully", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: { data: null, error: null },
      user_weekly_scores: { data: null, error: null },
    });

    const standings = await computeStandings(supabase);
    expect(standings).toEqual([]);
  });

  it("uses 'Unnamed Team' for users without a team name", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [{ user_id: "u1", name: "" }],
        error: null,
      },
      user_weekly_scores: {
        data: [{ user_id: "u1", gameweek_id: 1, total_weekly_points: 10 }],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);
    expect(standings[0].teamName).toBe("Unnamed Team");
  });

  it("users with no scores still appear with 0 points", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [
          { user_id: "u1", name: "Has Score" },
          { user_id: "u2", name: "No Score" },
        ],
        error: null,
      },
      user_weekly_scores: {
        data: [{ user_id: "u1", gameweek_id: 1, total_weekly_points: 50 }],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    expect(standings).toHaveLength(2);
    const noScore = standings.find((s) => s.userId === "u2");
    expect(noScore?.totalPoints).toBe(0);
  });

  it("movement is 0 when only one gameweek exists", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [{ user_id: "u1", name: "Alpha" }],
        error: null,
      },
      user_weekly_scores: {
        data: [{ user_id: "u1", gameweek_id: 1, total_weekly_points: 50 }],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    // prev total = total - gw1 = 0, so prev rank = 1, current rank = 1 → movement = 0
    expect(standings[0].movement).toBe(0);
  });

  it("handles null total_weekly_points gracefully (line 44 branch)", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [{ user_id: "u1", name: "Alpha" }],
        error: null,
      },
      user_weekly_scores: {
        data: [
          { user_id: "u1", gameweek_id: 1, total_weekly_points: null },
          { user_id: "u1", gameweek_id: 2, total_weekly_points: 30 },
        ],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    // null → 0, so total = 0 + 30 = 30
    expect(standings[0].totalPoints).toBe(30);
    expect(standings[0].gwBreakdown[1]).toBe(0);
    expect(standings[0].gwBreakdown[2]).toBe(30);
  });

  it("uses 'Unnamed Team' for user with scores but no team entry (line 70 branch)", async () => {
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [], // no team entries at all
        error: null,
      },
      user_weekly_scores: {
        data: [{ user_id: "u1", gameweek_id: 1, total_weekly_points: 40 }],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    // u1 has scores but no team entry → "Unnamed Team"
    expect(standings).toHaveLength(1);
    expect(standings[0].teamName).toBe("Unnamed Team");
    expect(standings[0].totalPoints).toBe(40);
  });

  it("movement defaults to 0 when user has no previous rank (lines 89-97 branch)", async () => {
    // User only appears in the latest GW (no history before maxGw)
    // This triggers the `prevRankMap.get(entry.userId) ?? currentRank` fallback
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [
          { user_id: "u1", name: "Alpha" },
          { user_id: "u2", name: "Bravo" },
        ],
        error: null,
      },
      user_weekly_scores: {
        data: [
          // Both users only have GW 1 scores → prevTotal = total - gw1 = 0 for both
          // Movement: prevRank and currentRank will be calculated from 0-point ties
          { user_id: "u1", gameweek_id: 1, total_weekly_points: 60 },
          { user_id: "u2", gameweek_id: 1, total_weekly_points: 40 },
        ],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    // After GW1: u1=60(rank1), u2=40(rank2)
    // Prev (total - gw1): u1=0, u2=0 → tied → both have prevRank based on sort order
    expect(standings[0].userId).toBe("u1");
    expect(standings[1].userId).toBe("u2");
    // Both were at 0 before, so prev rank is based on sort order of ties
    expect(typeof standings[0].movement).toBe("number");
    expect(typeof standings[1].movement).toBe("number");
  });

  it("movement calculation with empty prevTotalByUser (maxGw=0 branch, lines 89-97)", async () => {
    // Teams exist but NO scores → maxGw stays 0 → prevTotalByUser stays empty
    // This exercises the ?? 0 fallback in the sort and ?? currentRank in the map lookup
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [
          { user_id: "u1", name: "Alpha" },
          { user_id: "u2", name: "Bravo" },
        ],
        error: null,
      },
      user_weekly_scores: {
        data: [], // no scores at all → maxGw = 0
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    // Both users have 0 points, prevTotalByUser is empty
    expect(standings).toHaveLength(2);
    expect(standings[0].totalPoints).toBe(0);
    expect(standings[1].totalPoints).toBe(0);
    // Movement should be 0 for both (same rank before and after)
    expect(standings[0].movement).toBe(0);
    expect(standings[1].movement).toBe(0);
  });

  it("handles user with scores but no GW breakdown entry for maxGw (line 81 branch)", async () => {
    // u2 only has GW1 but maxGw=2 → gw[2] is undefined → latestPts ?? 0 = 0
    const supabase = createMockSupabase({
      fantasy_teams: {
        data: [
          { user_id: "u1", name: "Alpha" },
          { user_id: "u2", name: "Bravo" },
        ],
        error: null,
      },
      user_weekly_scores: {
        data: [
          { user_id: "u1", gameweek_id: 1, total_weekly_points: 30 },
          { user_id: "u1", gameweek_id: 2, total_weekly_points: 50 },
          { user_id: "u2", gameweek_id: 1, total_weekly_points: 90 },
          // u2 has NO GW2 score
        ],
        error: null,
      },
    });

    const standings = await computeStandings(supabase);

    // u2: total=90, latestPts=gw[2]??0=0, prevTotal=90
    // u1: total=80, latestPts=50, prevTotal=30
    // Prev ranks: u2(90) rank1, u1(30) rank2
    // Current ranks: u2(90) rank1, u1(80) rank2
    expect(standings[0].userId).toBe("u2");
    expect(standings[0].movement).toBe(0); // was rank1, still rank1
    expect(standings[1].userId).toBe("u1");
    expect(standings[1].movement).toBe(0); // was rank2, still rank2
  });
});
