import { GET, POST } from "./route";
import { parseResponse, mockGetRequest, mockPostRequest } from "@/lib/test-helpers/api-mocks";

const mockGetUser = vi.fn();
const mockAuthFrom = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockAuthFrom,
    }),
}));

const mockAdminFrom = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseServerOrThrow: () => ({ from: mockAdminFrom }),
}));

// Allow all requests by default
vi.mock("@/lib/rate-limit", () => ({
  rateLimitResponse: vi.fn().mockReturnValue(null),
}));

const USER_ID = "user-transfer-test";

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

describe("GET /api/transfers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    authFail();
    const req = mockGetRequest("/api/transfers", { gw_id: "1" });
    const res = await GET(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 400 when gw_id is missing", async () => {
    authSuccess();
    const req = mockGetRequest("/api/transfers");
    const res = await GET(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("gw_id");
  });

  it("returns existing transfer state when found", async () => {
    authSuccess();

    const existingState = {
      free_transfers: 2,
      used_transfers: 1,
      wildcard_active: false,
      free_hit_active: false,
    };

    const transferLog = [
      { id: "t1", out_player_id: "p1", in_player_id: "p2", created_at: "2026-01-01" },
    ];

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_transfer_state") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: existingState, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "user_transfers") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: transferLog, error: null }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const req = mockGetRequest("/api/transfers", { gw_id: "3" });
    const res = await GET(req);
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.freeTransfers).toBe(2);
    expect(body.usedTransfers).toBe(1);
    expect(body.cost).toBe(0); // 1 used < 2 free → no cost
    expect(body.transfers).toHaveLength(1);
  });

  it("calculates cost correctly when over free transfers", async () => {
    authSuccess();

    const state = {
      free_transfers: 1,
      used_transfers: 3,
      wildcard_active: false,
      free_hit_active: false,
    };

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_transfer_state") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: state, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "user_transfers") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const req = mockGetRequest("/api/transfers", { gw_id: "3" });
    const res = await GET(req);
    const { body } = await parseResponse(res);

    // (3 used - 1 free) * 4 = 8 points cost
    expect(body.cost).toBe(8);
  });

  it("cost is 0 when wildcard is active", async () => {
    authSuccess();

    const state = {
      free_transfers: 1,
      used_transfers: 5,
      wildcard_active: true,
      free_hit_active: false,
    };

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "user_transfer_state") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: state, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "user_transfers") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const req = mockGetRequest("/api/transfers", { gw_id: "3" });
    const res = await GET(req);
    const { body } = await parseResponse(res);

    expect(body.cost).toBe(0);
    expect(body.wildcardActive).toBe(true);
  });
});

describe("POST /api/transfers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    authFail();
    const req = mockPostRequest("/api/transfers", {
      gameweekId: 1,
      playerOutId: "p1",
      playerInId: "p2",
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(401);
  });

  it("returns 400 when body validation fails", async () => {
    authSuccess();
    const req = mockPostRequest("/api/transfers", { gameweekId: "not-a-number" });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("Invalid");
  });

  it("returns 400 when transferring player for themselves", async () => {
    authSuccess();
    const req = mockPostRequest("/api/transfers", {
      gameweekId: 1,
      playerOutId: "p1",
      playerInId: "p1",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("Cannot transfer a player for themselves");
  });

  it("returns 404 when gameweek not found", async () => {
    authSuccess();

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "gameweeks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const req = mockPostRequest("/api/transfers", {
      gameweekId: 999,
      playerOutId: "p1",
      playerInId: "p2",
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(404);
  });

  it("returns 403 when deadline has passed", async () => {
    authSuccess();

    const pastDeadline = new Date(Date.now() - 86400_000).toISOString();

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "gameweeks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 1, deadline_time: pastDeadline, finalized: false },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const req = mockPostRequest("/api/transfers", {
      gameweekId: 1,
      playerOutId: "p1",
      playerInId: "p2",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(403);
    expect(body.error).toContain("Deadline");
  });

  it("returns 403 when gameweek is finalized", async () => {
    authSuccess();

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "gameweeks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 1, deadline_time: null, finalized: true },
                error: null,
              }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const req = mockPostRequest("/api/transfers", {
      gameweekId: 1,
      playerOutId: "p1",
      playerInId: "p2",
    });
    const res = await POST(req);
    const { status } = await parseResponse(res);
    expect(status).toBe(403);
  });

  it("returns 400 when player does not exist", async () => {
    authSuccess();

    const futureDeadline = new Date(Date.now() + 86400_000).toISOString();

    mockAdminFrom.mockImplementation((table: string) => {
      if (table === "gameweeks") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 1, deadline_time: futureDeadline, finalized: false },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "players") {
        // Only one player found (p1), p2 missing
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: [{ id: "p1" }],
              error: null,
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const req = mockPostRequest("/api/transfers", {
      gameweekId: 1,
      playerOutId: "p1",
      playerInId: "p2",
    });
    const res = await POST(req);
    const { status, body } = await parseResponse(res);
    expect(status).toBe(400);
    expect(body.error).toContain("p2");
  });
});
