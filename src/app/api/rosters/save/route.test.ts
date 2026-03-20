import { POST } from "./route";
import { parseResponse, mockPostRequest } from "@/lib/test-helpers/api-mocks";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

const mockAdminFrom = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseServerOrThrow: () => ({ from: mockAdminFrom }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitResponse: vi.fn().mockReturnValue(null),
}));

// Mock roster validation — allow by default, override per test
const mockValidate = vi.fn().mockReturnValue(null);
vi.mock("@/lib/roster-validation", () => ({
  validateSquadComposition: (...args: unknown[]) => mockValidate(...args),
}));

const USER_ID = "user-roster-test";
const FUTURE_DEADLINE = new Date(Date.now() + 86400_000).toISOString();
const PAST_DEADLINE = new Date(Date.now() - 86400_000).toISOString();

function authSuccess() {
  mockGetUser.mockResolvedValue({
    data: { user: { id: USER_ID } },
    error: null,
  });
}

function authFail() {
  mockGetUser.mockResolvedValue({
    data: { user: null },
    error: { message: "Not signed in" },
  });
}

/** Build a minimal valid squad of 17 player IDs */
function makeSquadIds(count = 17) {
  return Array.from({ length: count }, (_, i) => `player-${i + 1}`);
}

/** Build player rows that match squad IDs with valid costs */
function makePlayers(ids: string[]) {
  return ids.map((id, i) => ({
    id,
    now_cost: 5, // 5m each → 17 * 5 = 85m < 100m budget
    position: i === 0 ? "GK" : i < 4 ? "DEF" : i < 8 ? "MID" : "FWD",
    is_lady: i === 16, // last player is lady
    team_id: `team-${(i % 5) + 1}`, // max 4 per team (under limit of 3 only if we have 5+ teams)
    teams: { name: `Team ${(i % 5) + 1}`, short_name: `T${(i % 5) + 1}` },
  }));
}

/**
 * Set up the admin mock for a standard save flow.
 * Configures: gameweeks, players, fantasy_teams, user_rosters, current_squads, user_chips
 */
function setupSaveMock(overrides: {
  gwData?: Record<string, unknown> | null;
  gwError?: unknown;
  players?: Record<string, unknown>[];
  upsertError?: unknown;
} = {}) {
  const {
    gwData = { id: 1, deadline_time: FUTURE_DEADLINE, finalized: false },
    gwError = null,
    players: playerData,
    upsertError = null,
  } = overrides;

  const callCounts: Record<string, number> = {};

  mockAdminFrom.mockImplementation((table: string) => {
    callCounts[table] = (callCounts[table] || 0) + 1;

    if (table === "gameweeks") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: gwData, error: gwError }),
          }),
        }),
      };
    }

    if (table === "players") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: playerData ?? makePlayers(makeSquadIds()),
            error: null,
          }),
        }),
      };
    }

    if (table === "fantasy_teams") {
      return {
        upsert: vi.fn().mockResolvedValue({ error: null }),
      };
    }

    if (table === "user_rosters") {
      return {
        upsert: vi.fn().mockResolvedValue({ error: upsertError }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      };
    }

    if (table === "current_squads") {
      return {
        upsert: vi.fn().mockReturnValue({
          then: vi.fn((cb: (...args: unknown[]) => void) => cb({ error: null })),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            not: vi.fn().mockReturnValue({
              then: vi.fn((cb: (...args: unknown[]) => void) => cb({ error: null })),
            }),
          }),
        }),
      };
    }

    if (table === "user_chips") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
    }

    return {
      select: vi.fn().mockResolvedValue({ data: null, error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
    };
  });
}

describe("POST /api/rosters/save", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidate.mockReturnValue(null); // valid by default
  });

  // ── Auth ──

  it("returns 401 when not signed in", async () => {
    authFail();
    const req = mockPostRequest("/api/rosters/save", { gameweekId: 1, squadIds: ["a"] });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  // ── Input validation ──

  it("returns 400 on invalid body (missing required fields)", async () => {
    authSuccess();
    const req = mockPostRequest("/api/rosters/save", {});
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("Invalid");
  });

  it("returns 400 when squadIds is empty", async () => {
    authSuccess();
    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 1,
      squadIds: [],
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(400);
  });

  // ── Deadline enforcement ──

  it("returns 404 when gameweek not found", async () => {
    authSuccess();
    setupSaveMock({ gwData: null, gwError: { message: "not found" } });

    const ids = makeSquadIds();
    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 999,
      squadIds: ids,
      startingIds: ids.slice(0, 10),
      captainId: ids[0],
      viceId: ids[1],
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 403 when gameweek is finished", async () => {
    authSuccess();
    setupSaveMock({ gwData: { id: 1, deadline_time: FUTURE_DEADLINE, finalized: true } });

    const ids = makeSquadIds();
    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 1,
      squadIds: ids,
      startingIds: ids.slice(0, 10),
      captainId: ids[0],
      viceId: ids[1],
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(403);
    expect(body.error).toContain("finished");
  });

  it("returns 403 when deadline has passed", async () => {
    authSuccess();
    setupSaveMock({ gwData: { id: 1, deadline_time: PAST_DEADLINE, finalized: false } });

    const ids = makeSquadIds();
    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 1,
      squadIds: ids,
      startingIds: ids.slice(0, 10),
      captainId: ids[0],
      viceId: ids[1],
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(403);
    expect(body.error).toContain("Deadline");
  });

  // ── Budget validation ──

  it("returns 400 when squad cost exceeds budget", async () => {
    authSuccess();
    const ids = makeSquadIds();
    const expensivePlayers = makePlayers(ids).map((p) => ({ ...p, now_cost: 7 }));
    // 17 * 7 = 119m > 100m budget
    setupSaveMock({ players: expensivePlayers });

    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 1,
      squadIds: ids,
      startingIds: ids.slice(0, 10),
      captainId: ids[0],
      viceId: ids[1],
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("exceeds budget");
  });

  // ── Invalid player IDs ──

  it("returns 400 when player IDs don't exist in DB", async () => {
    authSuccess();
    const ids = makeSquadIds();
    // Return only 15 of 17 players
    setupSaveMock({ players: makePlayers(ids).slice(0, 15) });

    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 1,
      squadIds: ids,
      startingIds: ids.slice(0, 10),
      captainId: ids[0],
      viceId: ids[1],
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("Invalid player IDs");
  });

  // ── Squad composition validation ──

  it("returns 400 when squad composition is invalid", async () => {
    authSuccess();
    setupSaveMock();
    mockValidate.mockReturnValue("Must have exactly 1 GK in starting XI");

    const ids = makeSquadIds();
    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 1,
      squadIds: ids,
      startingIds: ids.slice(0, 10),
      captainId: ids[0],
      viceId: ids[1],
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("GK");
  });

  // ── Chip validation ──

  it("returns 400 for invalid chip name", async () => {
    authSuccess();
    setupSaveMock();

    const ids = makeSquadIds();
    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 1,
      squadIds: ids,
      startingIds: ids.slice(0, 10),
      captainId: ids[0],
      viceId: ids[1],
      chip: "super_power", // not a valid chip
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    // Zod will reject this since it's not in the enum
    expect(status).toBe(400);
  });

  // ── Successful save ──

  it("returns success on valid save", async () => {
    authSuccess();
    setupSaveMock();

    const ids = makeSquadIds();
    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 1,
      squadIds: ids,
      startingIds: ids.slice(0, 10),
      captainId: ids[0],
      viceId: ids[1],
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.inserted).toBe(17);
  });

  it("returns 500 when upsert fails", async () => {
    authSuccess();
    setupSaveMock({ upsertError: { message: "DB write failed" } });

    const ids = makeSquadIds();
    const req = mockPostRequest("/api/rosters/save", {
      gameweekId: 1,
      squadIds: ids,
      startingIds: ids.slice(0, 10),
      captainId: ids[0],
      viceId: ids[1],
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(500);
    expect(body.error).toContain("Failed to save roster");
  });
});
