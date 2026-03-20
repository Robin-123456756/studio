import { GET } from "./route";
import { parseResponse } from "@/lib/test-helpers/api-mocks";

const mockFrom = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseServerOrThrow: () => ({ from: mockFrom }),
}));

/** Helper: build a gameweek row */
function gw(
  id: number,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    id,
    is_current: false,
    is_next: false,
    is_started: false,
    finalized: false,
    deadline_time: null,
    ...overrides,
  };
}

/**
 * Wire up mockFrom so that:
 *   from("gameweeks").select("*").order(...) → { data: gws, error: null }
 *   from("matches").select("gameweek_id").in(...).or(...) → { data: playedMatches, error: null }
 */
function setupMock(
  gws: Record<string, unknown>[],
  playedMatches: { gameweek_id: number }[] = []
) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "gameweeks") {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: gws, error: null }),
        }),
      };
    }
    if (table === "matches") {
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            or: vi.fn().mockResolvedValue({ data: playedMatches, error: null }),
          }),
        }),
      };
    }
    return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
  });
}

describe("GET /api/gameweeks/current", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 on gameweeks fetch error", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }),
      }),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body.code).toBe("GAMEWEEKS_FETCH_FAILED");
  });

  it("returns null current and next when no gameweeks exist", async () => {
    setupMock([]);

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.current).toBeNull();
    expect(body.next).toBeNull();
    expect(body.all).toEqual([]);
  });

  it("uses explicit is_current flag when set", async () => {
    const gws = [
      gw(1, { finalized: true }),
      gw(2, { is_current: true }),
      gw(3),
    ];
    setupMock(gws);

    const res = await GET();
    const { body } = await parseResponse(res);

    expect(body.current.id).toBe(2);
  });

  it("selects next GW as the one after current", async () => {
    const gws = [
      gw(1, { finalized: true }),
      gw(2, { is_current: true }),
      gw(3),
      gw(4),
    ];
    setupMock(gws);

    const res = await GET();
    const { body } = await parseResponse(res);

    expect(body.current.id).toBe(2);
    expect(body.next.id).toBe(3);
  });

  it("uses explicit is_next flag", async () => {
    const gws = [
      gw(1, { is_current: true }),
      gw(2),
      gw(3, { is_next: true }),
    ];
    setupMock(gws);

    const res = await GET();
    const { body } = await parseResponse(res);

    expect(body.next.id).toBe(3);
  });

  it("falls back to last GW when all are finished", async () => {
    const gws = [
      gw(1, { finalized: true }),
      gw(2, { finalized: true }),
      gw(3, { finalized: true }),
    ];
    setupMock(gws);

    const res = await GET();
    const { body } = await parseResponse(res);

    expect(body.current.id).toBe(3);
    expect(body.next).toBeNull();
  });

  it("enriches GWs with hasPlayedMatches", async () => {
    const gws = [gw(1, { is_current: true }), gw(2)];
    const playedMatches = [{ gameweek_id: 1 }];
    setupMock(gws, playedMatches);

    const res = await GET();
    const { body } = await parseResponse(res);

    const gw1 = body.all.find((g: any) => g.id === 1);
    const gw2 = body.all.find((g: any) => g.id === 2);

    expect(gw1.hasPlayedMatches).toBe(true);
    expect(gw2.hasPlayedMatches).toBe(false);
  });

  it("defaults hasPlayedMatches to true when match query fails", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "gameweeks") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [gw(1, { is_current: true })],
              error: null,
            }),
          }),
        };
      }
      if (table === "matches") {
        return {
          select: vi.fn().mockReturnValue({
            in: vi.fn().mockReturnValue({
              or: vi.fn().mockResolvedValue({ data: null, error: { message: "fail" } }),
            }),
          }),
        };
      }
      return { select: vi.fn().mockResolvedValue({ data: null, error: null }) };
    });

    const res = await GET();
    const { body } = await parseResponse(res);

    expect(body.all[0].hasPlayedMatches).toBe(true);
  });

  it("selects latest started-not-finished when no is_current flag", async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const gws = [
      gw(1, { deadline_time: past, finalized: true }),
      gw(2, { deadline_time: past }),
      gw(3),
    ];
    setupMock(gws);

    const res = await GET();
    const { body } = await parseResponse(res);

    // GW2 is started (deadline in past) and not finished → current
    expect(body.current.id).toBe(2);
  });
});
