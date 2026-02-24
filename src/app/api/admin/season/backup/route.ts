import { NextResponse } from "next/server";
import { requireAdminSession, SUPER_ADMIN_ONLY } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** POST /api/admin/season/backup — download full season data as JSON */
export async function POST() {
  const { error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    // Fetch all tables in parallel
    const [
      playersRes,
      teamsRes,
      gameweeksRes,
      matchesRes,
      playerStatsRes,
      playerMatchEventsRes,
      userRostersRes,
      userWeeklyScoresRes,
      userChipsRes,
      userTransfersRes,
      userTransferStateRes,
      voiceAuditRes,
      activityFeedRes,
    ] = await Promise.all([
      supabase.from("players").select("*"),
      supabase.from("teams").select("*"),
      supabase.from("gameweeks").select("*"),
      supabase.from("matches").select("*"),
      supabase.from("player_stats").select("*"),
      supabase.from("player_match_events").select("*"),
      supabase.from("user_rosters").select("*"),
      supabase.from("user_weekly_scores").select("*"),
      supabase.from("user_chips").select("*"),
      supabase.from("user_transfers").select("*"),
      supabase.from("user_transfer_state").select("*"),
      supabase.from("voice_audit_log").select("*"),
      supabase.from("activity_feed").select("*"),
    ]);

    const backup = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      tables: {
        players: playersRes.data ?? [],
        teams: teamsRes.data ?? [],
        gameweeks: gameweeksRes.data ?? [],
        matches: matchesRes.data ?? [],
        player_stats: playerStatsRes.data ?? [],
        player_match_events: playerMatchEventsRes.data ?? [],
        user_rosters: userRostersRes.data ?? [],
        user_weekly_scores: userWeeklyScoresRes.data ?? [],
        user_chips: userChipsRes.data ?? [],
        user_transfers: userTransfersRes.data ?? [],
        user_transfer_state: userTransferStateRes.data ?? [],
        voice_audit_log: voiceAuditRes.data ?? [],
        activity_feed: activityFeedRes.data ?? [],
      },
      rowCounts: {
        players: (playersRes.data ?? []).length,
        teams: (teamsRes.data ?? []).length,
        gameweeks: (gameweeksRes.data ?? []).length,
        matches: (matchesRes.data ?? []).length,
        player_stats: (playerStatsRes.data ?? []).length,
        player_match_events: (playerMatchEventsRes.data ?? []).length,
        user_rosters: (userRostersRes.data ?? []).length,
        user_weekly_scores: (userWeeklyScoresRes.data ?? []).length,
        user_chips: (userChipsRes.data ?? []).length,
        user_transfers: (userTransfersRes.data ?? []).length,
        user_transfer_state: (userTransferStateRes.data ?? []).length,
        voice_audit_log: (voiceAuditRes.data ?? []).length,
        activity_feed: (activityFeedRes.data ?? []).length,
      },
    };

    const jsonStr = JSON.stringify(backup, null, 2);
    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(jsonStr, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="budo-league-backup-${date}.json"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Backup failed" }, { status: 500 });
  }
}
