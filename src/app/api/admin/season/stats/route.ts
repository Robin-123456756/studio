import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/season/stats — season overview stats */
export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const [gwRes, matchRes, playerRes, teamRes, managerRes, scoresRes] = await Promise.all([
      supabase.from("gameweeks").select("id", { count: "exact", head: true }),
      supabase.from("matches").select("id, is_played", { count: "exact" }),
      supabase.from("players").select("id", { count: "exact", head: true }),
      supabase.from("teams").select("id", { count: "exact", head: true }),
      supabase.from("fantasy_teams").select("user_id", { count: "exact", head: true }),
      supabase.from("user_weekly_scores").select("user_id, total_weekly_points"),
    ]);

    const scores = scoresRes.data ?? [];

    // Top scorer
    const userTotals = new Map<string, number>();
    for (const s of scores) {
      const uid = (s as any).user_id;
      userTotals.set(uid, (userTotals.get(uid) || 0) + ((s as any).total_weekly_points || 0));
    }
    let topScorer = { userId: "", points: 0 };
    for (const [uid, pts] of userTotals) {
      if (pts > topScorer.points) topScorer = { userId: uid, points: pts };
    }

    // Average score per GW
    const allPts = scores.map((s: any) => s.total_weekly_points || 0);
    const avgScore = allPts.length > 0 ? Math.round(allPts.reduce((a: number, b: number) => a + b, 0) / allPts.length) : 0;

    const matchesPlayed = (matchRes.data ?? []).filter((m: any) => m.is_played).length;

    return NextResponse.json({
      totalGameweeks: gwRes.count ?? 0,
      totalMatches: matchRes.count ?? 0,
      matchesPlayed,
      totalPlayers: playerRes.count ?? 0,
      totalTeams: teamRes.count ?? 0,
      totalManagers: managerRes.count ?? 0,
      topScorer,
      avgScorePerGw: avgScore,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}
