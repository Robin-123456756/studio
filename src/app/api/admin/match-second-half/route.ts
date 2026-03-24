import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** POST /api/admin/match-second-half — resume match from half time */
export async function POST(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const { matchId } = await req.json();

    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    const { data: match, error: fetchErr } = await supabase
      .from("matches")
      .select("id, is_played, is_final, is_half_time")
      .eq("id", matchId)
      .single();

    if (fetchErr || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    if (!match.is_played) {
      return NextResponse.json({ error: "Match has not started yet" }, { status: 400 });
    }

    if (match.is_final) {
      return NextResponse.json({ error: "Match is already finished" }, { status: 400 });
    }

    if (!match.is_half_time) {
      return NextResponse.json({ error: "Match is not at half time" }, { status: 400 });
    }

    // Set started_at to (now - 30 minutes) so the clock formula gives 30+ going forward
    const secondHalfStart = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { error: updateErr } = await supabase
      .from("matches")
      .update({
        is_half_time: false,
        started_at: secondHalfStart,
        minutes: 30,
      })
      .eq("id", matchId);

    if (updateErr) {
      return apiError("Failed to start second half", "MATCH_SECOND_HALF_FAILED", 500, updateErr);
    }

    return NextResponse.json({ ok: true, started_at: secondHalfStart });
  } catch (e: unknown) {
    return apiError("Failed to start second half", "MATCH_SECOND_HALF_FAILED", 500, e);
  }
}
