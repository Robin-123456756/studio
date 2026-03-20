import { GET } from "./route";
import { parseResponse } from "@/lib/test-helpers/api-mocks";

// Mock the admin Supabase client
const mockFrom = vi.fn();
vi.mock("@/lib/supabase-admin", () => ({
  getSupabaseServerOrThrow: () => ({ from: mockFrom }),
}));

describe("GET /api/teams", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all teams sorted by name", async () => {
    const teams = [
      { id: 1, team_uuid: "uuid-a", name: "Alpha FC", short_name: "ALP", team_code: "A", logo_url: "/a.png" },
      { id: 2, team_uuid: "uuid-b", name: "Bravo FC", short_name: "BRV", team_code: "B", logo_url: "/b.png" },
    ];

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: teams, error: null }),
      }),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.teams).toHaveLength(2);
    expect(body.teams[0].name).toBe("Alpha FC");
    expect(body.teams[1].name).toBe("Bravo FC");
  });

  it("returns empty array when no teams exist", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.teams).toEqual([]);
  });

  it("returns 500 on database error", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: { message: "DB down" } }),
      }),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(500);
    expect(body.error).toBeDefined();
    expect(body.code).toBe("TEAMS_FETCH_FAILED");
  });

  it("sets cache headers on success", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });

    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=60");
  });

  it("handles null data gracefully (returns empty array)", async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });

    const res = await GET();
    const { status, body } = await parseResponse(res);

    expect(status).toBe(200);
    expect(body.teams).toEqual([]);
  });
});
