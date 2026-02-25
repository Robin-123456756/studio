import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    // Get current GW
    const { data: currentGw } = await supabase
      .from("gameweeks")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();

    const currentGwId = currentGw?.id ?? null;

    const [
      unscoredRes,
      unfinalizedRes,
      zeroPriceRes,
      noDeadlineRes,
      noTeamRes,
      playersByTeam,
      allTeams,
    ] = await Promise.all([
      // Unscored matches in current GW
      currentGwId
        ? supabase
            .from("matches")
            .select("id", { count: "exact", head: true })
            .eq("gameweek_id", currentGwId)
            .eq("is_played", false)
        : Promise.resolve({ count: 0 }),
      // Unfinalized past GWs
      currentGwId
        ? supabase
            .from("gameweeks")
            .select("id", { count: "exact", head: true })
            .lt("id", currentGwId)
            .neq("finalized", true)
        : Promise.resolve({ count: 0 }),
      // Players with price 0 or null
      supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .or("now_cost.eq.0,now_cost.is.null"),
      // GWs without deadlines
      supabase
        .from("gameweeks")
        .select("id", { count: "exact", head: true })
        .is("deadline_time", null),
      // Players without teams
      supabase
        .from("players")
        .select("id", { count: "exact", head: true })
        .is("team_id", null),
      // Player counts per team
      supabase.from("players").select("team_id"),
      // All teams
      supabase.from("teams").select("id, team_uuid, name"),
    ]);

    const warnings: Array<{
      key: string;
      severity: "error" | "warning";
      message: string;
      count: number;
      link?: string;
    }> = [];

    // Unscored matches
    const unscoredCount = (unscoredRes as any).count || 0;
    if (unscoredCount > 0 && currentGwId) {
      warnings.push({
        key: "unscored",
        severity: "error",
        message: `${unscoredCount} match${unscoredCount > 1 ? "es" : ""} in GW ${currentGwId} without scores`,
        count: unscoredCount,
        link: "/admin/scores",
      });
    }

    // Unfinalized past GWs
    const unfinalizedCount = (unfinalizedRes as any).count || 0;
    if (unfinalizedCount > 0) {
      warnings.push({
        key: "unfinalized",
        severity: "warning",
        message: `${unfinalizedCount} past gameweek${unfinalizedCount > 1 ? "s" : ""} not finalized`,
        count: unfinalizedCount,
        link: "/admin/gameweeks",
      });
    }

    // Zero price players
    const zeroPriceCount = (zeroPriceRes as any).count || 0;
    if (zeroPriceCount > 0) {
      warnings.push({
        key: "zero-price",
        severity: "warning",
        message: `${zeroPriceCount} player${zeroPriceCount > 1 ? "s" : ""} with price 0 or unset`,
        count: zeroPriceCount,
        link: "/admin/players",
      });
    }

    // GWs without deadlines
    const noDeadlineCount = (noDeadlineRes as any).count || 0;
    if (noDeadlineCount > 0) {
      warnings.push({
        key: "no-deadline",
        severity: "warning",
        message: `${noDeadlineCount} gameweek${noDeadlineCount > 1 ? "s" : ""} without a deadline`,
        count: noDeadlineCount,
        link: "/admin/gameweeks",
      });
    }

    // Players without teams
    const noTeamCount = (noTeamRes as any).count || 0;
    if (noTeamCount > 0) {
      warnings.push({
        key: "no-team",
        severity: "error",
        message: `${noTeamCount} player${noTeamCount > 1 ? "s" : ""} not assigned to any team`,
        count: noTeamCount,
        link: "/admin/players",
      });
    }

    // Teams with fewer than 11 players
    const teamCounts = new Map<string, number>();
    for (const row of (playersByTeam as any).data ?? []) {
      const tid = (row as any).team_id;
      if (tid != null) teamCounts.set(String(tid), (teamCounts.get(String(tid)) || 0) + 1);
    }
    const teamsData = (allTeams as any).data ?? [];
    const smallTeams = teamsData.filter((t: any) => (teamCounts.get(t.team_uuid) || 0) < 11);
    if (smallTeams.length > 0) {
      warnings.push({
        key: "small-teams",
        severity: "warning",
        message: `${smallTeams.length} team${smallTeams.length > 1 ? "s" : ""} with fewer than 11 players`,
        count: smallTeams.length,
        link: "/admin/teams",
      });
    }

    // No current GW set
    if (!currentGwId) {
      warnings.push({
        key: "no-current-gw",
        severity: "error",
        message: "No current gameweek set",
        count: 1,
        link: "/admin/gameweeks",
      });
    }

    return NextResponse.json({ warnings });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to check data health" }, { status: 500 });
  }
}
