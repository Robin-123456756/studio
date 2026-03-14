import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** POST /api/admin/match-minutes — update current match minute */
export async function POST(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const { matchId, minutes } = await req.json();

    if (!matchId || typeof minutes !== "number" || minutes < 0 || minutes > 70) {
      return NextResponse.json({ error: "Invalid matchId or minutes (0-70)" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();

    // Verify match is live (started but not finished)
    const { data: match, error: fetchErr } = await supabase
      .from("matches")
      .select("id, is_played, is_final")
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

    const { error } = await supabase
      .from("matches")
      .update({ minutes })
      .eq("id", matchId);

    if (error) {
      return apiError("Failed to update match minutes", "MATCH_MINUTES_UPDATE_FAILED", 500, error);
    }

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return apiError("Failed to update match minutes", "MATCH_MINUTES_FAILED", 500, e);
  }
}
