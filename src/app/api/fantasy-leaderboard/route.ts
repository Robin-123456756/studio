import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseServerOrThrow();

    // Overall leaderboard from fantasy_teams
    const { data: teams, error: teamsErr } = await supabase
      .from("fantasy_teams")
      .select("user_id, name, total_points, points")
      .order("total_points", { ascending: false });

    if (teamsErr) {
      return NextResponse.json({ error: teamsErr.message }, { status: 500 });
    }

    // GW-by-GW breakdown from user_weekly_scores
    const { data: allGwScores } = await supabase
      .from("user_weekly_scores")
      .select("user_id, gameweek_id, total_weekly_points")
      .order("gameweek_id", { ascending: true });

    const byUser = new Map<string, Record<number, number>>();
    for (const s of allGwScores ?? []) {
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, {});
      byUser.get(s.user_id)![s.gameweek_id] = Number(s.total_weekly_points ?? 0);
    }

    const leaderboard = (teams ?? []).map((t: any, i: number) => ({
      rank: i + 1,
      userId: t.user_id,
      teamName: t.name || "Unnamed Team",
      totalPoints: Number(t.total_points ?? t.points ?? 0),
      gwBreakdown: byUser.get(t.user_id) ?? {},
    }));

    return NextResponse.json({ leaderboard });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed" },
      { status: 500 }
    );
  }
}
