import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { calculateMatchBonus } from "@/lib/bonus-calculator";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** GET /api/admin/bonus-points?match_id=N — BPS rankings with auto-assigned bonus */
export async function GET(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("match_id");

  if (!matchId) {
    return NextResponse.json({ error: "match_id required" }, { status: 400 });
  }

  try {
    const entries = await calculateMatchBonus(Number(matchId));
    return NextResponse.json({ performers: entries });
  } catch (e: unknown) {
    return apiError("Failed to calculate bonus points", "BONUS_CALC_FAILED", 500, e);
  }
}
