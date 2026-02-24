import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/analytics — analytics data for all tabs */
export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const [
      scoresRes,
      playerStatsRes,
      transfersRes,
      chipsRes,
      rostersRes,
      playersRes,
      teamsRes,
    ] = await Promise.all([
      supabase.from("user_weekly_scores").select("user_id, gameweek_id, total_weekly_points"),
      supabase.from("player_stats").select("player_id, gameweek_id, goals, assists, clean_sheets, points"),
      supabase.from("user_transfers").select("user_id, gameweek_id"),
      supabase.from("user_chips").select("user_id, chip, gameweek_id"),
      supabase.from("user_rosters").select("user_id, gameweek_id"),
      supabase.from("players").select("id, web_name, name, position, team_id, total_points"),
      supabase.from("teams").select("id, name, short_name"),
    ]);

    const scores = scoresRes.data ?? [];
    const playerStats = playerStatsRes.data ?? [];
    const transfers = transfersRes.data ?? [];
    const chips = chipsRes.data ?? [];
    const rosters = rostersRes.data ?? [];
    const players = playersRes.data ?? [];
    const teams = teamsRes.data ?? [];

    // --- Overview Tab ---
    // GW-by-GW average, high, low
    const gwScoreMap = new Map<number, number[]>();
    for (const s of scores) {
      const gw = (s as any).gameweek_id;
      const pts = (s as any).total_weekly_points || 0;
      if (!gwScoreMap.has(gw)) gwScoreMap.set(gw, []);
      gwScoreMap.get(gw)!.push(pts);
    }

    const gwBreakdown = Array.from(gwScoreMap.entries())
      .map(([gw, pts]) => ({
        gameweek: gw,
        avg: Math.round(pts.reduce((a, b) => a + b, 0) / pts.length),
        high: Math.max(...pts),
        low: Math.min(...pts),
        managers: pts.length,
      }))
      .sort((a, b) => a.gameweek - b.gameweek);

    // Most transferred (count per player in transfers)
    const transferCounts = new Map<string, number>();
    for (const t of transfers) {
      const uid = (t as any).user_id;
      transferCounts.set(uid, (transferCounts.get(uid) || 0) + 1);
    }

    // --- Players Tab ---
    // Top scorers from player_stats
    const playerPtsMap = new Map<string, { goals: number; assists: number; cleanSheets: number; points: number }>();
    for (const ps of playerStats) {
      const pid = (ps as any).player_id;
      const existing = playerPtsMap.get(pid) || { goals: 0, assists: 0, cleanSheets: 0, points: 0 };
      existing.goals += (ps as any).goals || 0;
      existing.assists += (ps as any).assists || 0;
      existing.cleanSheets += (ps as any).clean_sheets || 0;
      existing.points += (ps as any).points || 0;
      playerPtsMap.set(pid, existing);
    }

    const playerMap = new Map<string, any>();
    for (const p of players) playerMap.set(p.id, p);

    const teamMap = new Map<number, any>();
    for (const t of teams) teamMap.set(t.id, t);

    const topScorers = Array.from(playerPtsMap.entries())
      .map(([pid, stats]) => {
        const p = playerMap.get(pid);
        return {
          playerId: pid,
          name: p?.web_name || p?.name || "Unknown",
          position: p?.position || "?",
          teamName: teamMap.get(p?.team_id)?.short_name || "?",
          ...stats,
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 20);

    const topAssists = [...topScorers].sort((a, b) => b.assists - a.assists).slice(0, 20);
    const topCleanSheets = [...topScorers].filter((p) => ["GK", "DEF"].includes(p.position)).sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 10);

    // --- Teams Tab ---
    const teamPointsMap = new Map<number, number>();
    for (const p of players) {
      const tid = p.team_id;
      teamPointsMap.set(tid, (teamPointsMap.get(tid) || 0) + (p.total_points || 0));
    }

    const teamRankings = teams.map((t: any) => ({
      teamId: t.id,
      name: t.name,
      shortName: t.short_name,
      totalPoints: teamPointsMap.get(t.id) || 0,
    })).sort((a: any, b: any) => b.totalPoints - a.totalPoints);

    // --- Engagement Tab ---
    // Picks per GW
    const picksPerGw = new Map<number, Set<string>>();
    for (const r of rosters) {
      const gw = (r as any).gameweek_id;
      const uid = (r as any).user_id;
      if (!picksPerGw.has(gw)) picksPerGw.set(gw, new Set());
      picksPerGw.get(gw)!.add(uid);
    }
    const pickBreakdown = Array.from(picksPerGw.entries())
      .map(([gw, users]) => ({ gameweek: gw, managers: users.size }))
      .sort((a, b) => a.gameweek - b.gameweek);

    // Transfers per GW
    const transfersPerGw = new Map<number, number>();
    for (const t of transfers) {
      const gw = (t as any).gameweek_id;
      transfersPerGw.set(gw, (transfersPerGw.get(gw) || 0) + 1);
    }
    const transferBreakdown = Array.from(transfersPerGw.entries())
      .map(([gw, count]) => ({ gameweek: gw, transfers: count }))
      .sort((a, b) => a.gameweek - b.gameweek);

    // Chips by type
    const chipCounts = new Map<string, number>();
    for (const c of chips) {
      const chip = (c as any).chip;
      chipCounts.set(chip, (chipCounts.get(chip) || 0) + 1);
    }
    const chipBreakdown = Array.from(chipCounts.entries())
      .map(([chip, count]) => ({ chip, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      overview: { gwBreakdown },
      players: { topScorers, topAssists, topCleanSheets },
      teams: { teamRankings },
      engagement: { pickBreakdown, transferBreakdown, chipBreakdown },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
