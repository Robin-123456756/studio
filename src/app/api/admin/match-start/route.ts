import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { sendPushToAll } from "@/lib/push-notifications";
import { buildMatchStartedPush } from "@/lib/push-message-builders";

export const dynamic = "force-dynamic";

/** POST /api/admin/match-start — mark match as started and send push */
export async function POST(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const { matchId } = await req.json();

    if (!matchId) {
      return NextResponse.json({ error: "matchId required" }, { status: 400 });
    }

    // Fetch match with team names
    const { data: match, error: fetchErr } = await supabase
      .from("matches")
      .select(`
        id, is_played, home_goals, away_goals,
        home_team:teams!matches_home_team_uuid_fkey (name),
        away_team:teams!matches_away_team_uuid_fkey (name)
      `)
      .eq("id", matchId)
      .single();

    if (fetchErr || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Mark as played (set is_played = true, initialize score to 0-0 if null)
    const { error: updateErr } = await supabase
      .from("matches")
      .update({
        is_played: true,
        home_goals: match.home_goals ?? 0,
        away_goals: match.away_goals ?? 0,
      })
      .eq("id", matchId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // Send "KICK OFF!" push (fire-and-forget)
    sendPushToAll(
      buildMatchStartedPush({
        matchId,
        homeTeam: (match.home_team as any)?.name || "Home",
        awayTeam: (match.away_team as any)?.name || "Away",
        homeGoals: 0,
        awayGoals: 0,
      })
    ).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
