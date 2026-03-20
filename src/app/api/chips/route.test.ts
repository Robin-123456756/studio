import { GET } from "./route";
import { parseResponse } from "@/lib/test-helpers/api-mocks";

// Mock supabaseServer (cookie-based auth)
const mockGetUser = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  supabaseServer: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
      from: mockFrom,
    }),
}));

// Mock rate limiter — allow by default
vi.mock("@/lib/rate-limit", () => ({
  rateLimitResponse: vi.fn().mockReturnValue(null),
  RATE_LIMIT_STANDARD: { maxRequests: 30, windowMs: 60_000 },
}));

const USER_ID = "user-123";

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

describe("GET /api/chips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not signed in", async () => {
    authFail();

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(401);
    expect(body.error).toContain("Not signed in");
  });

  it("returns used chips for authenticated user", async () => {
    authSuccess();

    const chips = [
      { chip: "wildcard", gameweek_id: 3, activated_at: "2026-01-15T10:00:00Z" },
      { chip: "bench_boost", gameweek_id: 5, activated_at: "2026-02-01T10:00:00Z" },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: chips, error: null }),
        }),
      }),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.usedChips).toEqual(["wildcard", "bench_boost"]);
    expect(body.details).toHaveLength(2);
  });

  it("returns empty arrays when no chips used", async () => {
    authSuccess();

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.usedChips).toEqual([]);
    expect(body.details).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    authSuccess();

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB fail" } }),
        }),
      }),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body.code).toBe("CHIPS_FETCH_FAILED");
  });

  it("handles null data gracefully", async () => {
    authSuccess();

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.usedChips).toEqual([]);
  });
});
