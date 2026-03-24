import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { sendPushToAll } from "@/lib/push-notifications";
import { buildHalfTimePush } from "@/lib/push-message-builders";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/** POST /api/admin/match-halftime — mark match as half time and send push */
export async function POST(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const { matchId } = await req.json();

    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    // Fetch match with team names and current score
    const { data: match, error: fetchErr } = await supabase
      .from("matches")
      .select(`
        id, is_played, is_final, is_half_time, home_goals, away_goals,
        home_team:teams!matches_home_team_uuid_fkey (name),
        away_team:teams!matches_away_team_uuid_fkey (name)
      `)
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

    // Toggle half time and set minutes to 30
    const { error: updateErr } = await supabase
      .from("matches")
      .update({ is_half_time: true, minutes: 30 })
      .eq("id", matchId);

    if (updateErr) {
      return apiError("Failed to set half time", "MATCH_HALFTIME_UPDATE_FAILED", 500, updateErr);
    }

    // Send "HALF TIME" push (fire-and-forget)
    sendPushToAll(
      buildHalfTimePush({
        matchId,
        homeTeam: (match.home_team as any)?.name || "Home",
        awayTeam: (match.away_team as any)?.name || "Away",
        homeGoals: match.home_goals ?? 0,
        awayGoals: match.away_goals ?? 0,
      })
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return apiError("Failed to set half time", "MATCH_HALFTIME_FAILED", 500, e);
  }
}
