import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/data-health/fix-clean-sheets
 *
 * One-time cleanup: scans all played matches and:
 * 1. Deletes false clean_sheet events where the team actually conceded
 * 2. Updates player_stats.clean_sheet = false for affected players
 * 3. Reports what was fixed
 */
export async function POST() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const supabase = getSupabaseServerOrThrow();

    // 1. Get all played matches
    const { data: matches, error: mErr } = await supabase
      .from("matches")
      .select("id, gameweek_id, home_team_uuid, away_team_uuid, home_goals, away_goals")
      .or("is_played.eq.true,is_final.eq.true");

    if (mErr) throw mErr;

    let deletedEvents = 0;
    let fixedStats = 0;
    const details: string[] = [];

    for (const m of matches ?? []) {
      // Teams that conceded should NOT have clean sheets
      const concededTeamUuids: string[] = [];
      if ((m.home_goals ?? 0) > 0 && m.away_team_uuid) {
        concededTeamUuids.push(m.away_team_uuid);
      }
      if ((m.away_goals ?? 0) > 0 && m.home_team_uuid) {
        concededTeamUuids.push(m.home_team_uuid);
      }

      for (const teamUuid of concededTeamUuids) {
        // Get all players on this team
        const { data: players } = await supabase
          .from("players")
          .select("id, name")
          .eq("team_id", teamUuid);

        const playerIds = (players ?? []).map((p) => p.id);
        if (playerIds.length === 0) continue;

        // Delete false clean_sheet events
        const { data: deleted } = await supabase
          .from("player_match_events")
          .delete()
          .eq("match_id", m.id)
          .eq("action", "clean_sheet")
          .in("player_id", playerIds)
          .select("player_id");

        if (deleted && deleted.length > 0) {
          deletedEvents += deleted.length;
          const names = deleted.map((d) => {
            const p = (players ?? []).find((pl) => pl.id === d.player_id);
            return p?.name ?? d.player_id;
          });
          details.push(
            `Match ${m.id} (GW${m.gameweek_id}, ${m.home_goals}-${m.away_goals}): removed CS for ${names.join(", ")}`
          );
        }

        // Fix stale player_stats.clean_sheet
        const { data: updatedStats } = await supabase
          .from("player_stats")
          .update({ clean_sheet: false })
          .in("player_id", playerIds)
          .eq("gameweek_id", m.gameweek_id)
          .eq("clean_sheet", true)
          .select("id");

        if (updatedStats && updatedStats.length > 0) fixedStats += updatedStats.length;
      }
    }

    return NextResponse.json({
      success: true,
      deletedEvents,
      fixedStats,
      details,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed" },
      { status: 500 }
    );
  }
}
