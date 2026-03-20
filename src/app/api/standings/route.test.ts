import { GET } from "./route";
import { parseResponse, mockGetRequest } from "@/lib/test-helpers/api-mocks";

const mockFrom = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseServerOrThrow: () => ({ from: mockFrom }),
}));

// Mock fetchAllRows — returns whatever the query builder would return
vi.mock("@/lib/fetch-all-rows", () => ({
  fetchAllRows: vi.fn().mockResolvedValue([]),
}));

const TEAM_A = "uuid-aaa";
const TEAM_B = "uuid-bbb";
const TEAM_C = "uuid-ccc";

const teams = [
  { team_uuid: TEAM_A, name: "Alpha FC", logo_url: "/a.png" },
  { team_uuid: TEAM_B, name: "Bravo FC", logo_url: "/b.png" },
  { team_uuid: TEAM_C, name: "Charlie FC", logo_url: "/c.png" },
];

/**
 * Wire up mockFrom for the standings route's multi-table queries.
 */
function setupStandingsMock(
  matches: Record<string, unknown>[] = [],
  playerStats: Record<string, unknown>[] = [],
  players: Record<string, unknown>[] = []
) {
  // Track call counts per table for disambiguation
  const callCounts: Record<string, number> = {};

  mockFrom.mockImplementation((table: string) => {
    callCounts[table] = (callCounts[table] || 0) + 1;

    if (table === "matches") {
      // First call: latest played GW lookup. Second call: match data.
      const callNum = callCounts[table];

      if (callNum === 1) {
        // Latest played match (for to_gw resolution)
        const latestGw = matches.length > 0
          ? Math.max(...matches.map((m: any) => m.gameweek_id))
          : null;
        return {
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: latestGw ? { gameweek_id: latestGw } : null,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }

      // Second call: actual matches with filters
      return {
        select: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              gte: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({ data: matches, error: null }),
              }),
              lte: vi.fn().mockResolvedValue({ data: matches, error: null }),
            }),
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({ data: matches, error: null }),
              order: vi.fn().mockReturnValue({
                lte: vi.fn().mockResolvedValue({ data: matches, error: null }),
              }),
            }),
          }),
        }),
      };
    }

    if (table === "teams") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: teams, error: null }),
        }),
      };
    }

    if (table === "player_stats") {
      return {
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({ data: playerStats, error: null }),
          }),
        }),
      };
    }

    if (table === "players") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: players, error: null }),
        }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
  });
}

describe("GET /api/standings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all teams with zero stats when no matches played", async () => {
    setupStandingsMock([], [], []);

    const req = mockGetRequest("/api/standings");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.rows).toHaveLength(3);

    for (const row of body.rows) {
      expect(row.PL).toBe(0);
      expect(row.W).toBe(0);
      expect(row.D).toBe(0);
      expect(row.L).toBe(0);
      expect(row.GF).toBe(0);
      expect(row.GA).toBe(0);
      expect(row.GD).toBe(0);
      expect(row.Pts).toBe(0);
      expect(row.LP).toBe(0);
    }
  });

  it("calculates W/D/L and Pts correctly (Pts = W*3 + D)", async () => {
    const matches = [
      // Alpha beats Bravo 2-1
      {
        id: "m1", gameweek_id: 1,
        home_team_uuid: TEAM_A, away_team_uuid: TEAM_B,
        home_goals: 2, away_goals: 1,
        is_played: true, is_final: true,
      },
      // Alpha draws Charlie 1-1
      {
        id: "m2", gameweek_id: 2,
        home_team_uuid: TEAM_A, away_team_uuid: TEAM_C,
        home_goals: 1, away_goals: 1,
        is_played: true, is_final: true,
      },
    ];

    setupStandingsMock(matches, [], []);

    const req = mockGetRequest("/api/standings");
    const res = await GET(req);
    const { body } = await parseResponse(res);

    const alpha = body.rows.find((r: any) => r.teamId === TEAM_A);
    const bravo = body.rows.find((r: any) => r.teamId === TEAM_B);
    const charlie = body.rows.find((r: any) => r.teamId === TEAM_C);

    // Alpha: 2 played, 1W 1D 0L, GF=3 GA=2, Pts=4
    expect(alpha.PL).toBe(2);
    expect(alpha.W).toBe(1);
    expect(alpha.D).toBe(1);
    expect(alpha.Pts).toBe(4); // 1*3 + 1 = 4
    expect(alpha.GF).toBe(3);
    expect(alpha.GA).toBe(2);
    expect(alpha.GD).toBe(1);

    // Bravo: 1 played, 0W 0D 1L, GF=1 GA=2, Pts=0
    expect(bravo.PL).toBe(1);
    expect(bravo.L).toBe(1);
    expect(bravo.Pts).toBe(0);

    // Charlie: 1 played, 0W 1D 0L, Pts=1
    expect(charlie.PL).toBe(1);
    expect(charlie.D).toBe(1);
    expect(charlie.Pts).toBe(1);
  });

  it("sorts by Pts DESC → GD DESC → GF DESC → name ASC", async () => {
    const matches = [
      // Alpha beats Bravo 3-0 → Alpha Pts=3, GD=3
      {
        id: "m1", gameweek_id: 1,
        home_team_uuid: TEAM_A, away_team_uuid: TEAM_B,
        home_goals: 3, away_goals: 0,
        is_played: true, is_final: true,
      },
      // Charlie beats Bravo 1-0 → Charlie Pts=3, GD=1
      {
        id: "m2", gameweek_id: 1,
        home_team_uuid: TEAM_C, away_team_uuid: TEAM_B,
        home_goals: 1, away_goals: 0,
        is_played: true, is_final: true,
      },
    ];

    setupStandingsMock(matches, [], []);

    const req = mockGetRequest("/api/standings");
    const res = await GET(req);
    const { body } = await parseResponse(res);

    // Both Alpha and Charlie have Pts=3, Alpha has better GD (3 vs 1)
    expect(body.rows[0].teamId).toBe(TEAM_A);
    expect(body.rows[1].teamId).toBe(TEAM_C);
    expect(body.rows[2].teamId).toBe(TEAM_B);
  });

  it("awards lady points when a lady player has stats in that GW", async () => {
    const matches = [
      {
        id: "m1", gameweek_id: 1,
        home_team_uuid: TEAM_A, away_team_uuid: TEAM_B,
        home_goals: 1, away_goals: 0,
        is_played: true, is_final: true,
      },
    ];

    // Lady player from Alpha played in GW1
    const playerStats = [
      { gameweek_id: 1, player_id: "lady-1" },
    ];

    const players = [
      { id: "lady-1", is_lady: true, teams: { team_uuid: TEAM_A } },
    ];

    setupStandingsMock(matches, playerStats, players);

    const req = mockGetRequest("/api/standings");
    const res = await GET(req);
    const { body } = await parseResponse(res);

    const alpha = body.rows.find((r: any) => r.teamId === TEAM_A);
    const bravo = body.rows.find((r: any) => r.teamId === TEAM_B);

    expect(alpha.LP).toBe(1);
    expect(bravo.LP).toBe(0);
  });

  it("sets cache headers on success", async () => {
    const matches = [
      {
        id: "m1", gameweek_id: 1,
        home_team_uuid: TEAM_A, away_team_uuid: TEAM_B,
        home_goals: 0, away_goals: 0,
        is_played: true, is_final: true,
      },
    ];
    setupStandingsMock(matches, [], []);

    const req = mockGetRequest("/api/standings");
    const res = await GET(req);

    expect(res.headers.get("Cache-Control")).toContain("s-maxage=30");
  });
});
