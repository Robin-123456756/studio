import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseServerOrThrow();

    // Fetch team names from fantasy_teams (no points columns)
    const { data: teams, error: teamsErr } = await supabase
      .from("fantasy_teams")
      .select("user_id, name");

    if (teamsErr) {
      return NextResponse.json({ error: teamsErr.message }, { status: 500 });
    }

    // GW-by-GW scores — this is the source of truth for points
    const { data: allGwScores } = await supabase
      .from("user_weekly_scores")
      .select("user_id, gameweek_id, total_weekly_points")
      .order("gameweek_id", { ascending: true });

    const byUser = new Map<string, Record<number, number>>();
    const totalByUser = new Map<string, number>();
    for (const s of allGwScores ?? []) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, {});
      const pts = Number(s.total_weekly_points ?? 0);
      byUser.get(s.user_id)![s.gameweek_id] = pts;
      totalByUser.set(s.user_id, (totalByUser.get(s.user_id) ?? 0) + pts);
    }

    const teamNameMap = new Map<string, string>();
    for (const t of teams ?? []) {
      teamNameMap.set(t.user_id, t.name || "Unnamed Team");
    }

    // Build leaderboard from all users who have scores, include team name if available
    const userIds = new Set([
      ...(teams ?? []).map((t: any) => t.user_id),
      ...totalByUser.keys(),
    ]);

    const leaderboard = Array.from(userIds)
      .map((uid) => ({
        rank: 0,
        userId: uid,
        teamName: teamNameMap.get(uid) || "Unnamed Team",
        totalPoints: totalByUser.get(uid) ?? 0,
        gwBreakdown: byUser.get(uid) ?? {},
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((entry, i) => ({ ...entry, rank: i + 1 }));

    return NextResponse.json(
      { leaderboard },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed" },
      { status: 500 }
    );
  }
}
