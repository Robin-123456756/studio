import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

/** GET /api/admin/gw-status — current GW status for dashboard widget */
export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    // Get current gameweek
    const { data: currentGw } = await supabase
      .from("gameweeks")
      .select("*")
      .eq("is_current", true)
      .maybeSingle();

    if (!currentGw) {
      return NextResponse.json({ hasCurrentGw: false });
    }

    const gwId = currentGw.id;

    // Run parallel queries for status data
    const [matchesRes, unscoredRes, picksRes, scoresRes] = await Promise.all([
      // Total matches this GW
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("gameweek_id", gwId),
      // Matches without scores (not played)
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("gameweek_id", gwId)
        .eq("is_played", false),
      // Users who made picks this GW
      supabase
        .from("user_rosters")
        .select("user_id", { count: "exact", head: true })
        .eq("gameweek_id", gwId),
      // Check if scores have been calculated (player_stats rows exist for this GW)
      supabase
        .from("player_stats")
        .select("id", { count: "exact", head: true })
        .eq("gameweek_id", gwId),
    ]);

    // Count unique users with picks
    let uniquePickers = 0;
    if (picksRes.count && picksRes.count > 0) {
      const { data: rosterUsers } = await supabase
        .from("user_rosters")
        .select("user_id")
        .eq("gameweek_id", gwId);
      const uniqueIds = new Set((rosterUsers ?? []).map((r: any) => r.user_id));
      uniquePickers = uniqueIds.size;
    }

    const totalMatches = matchesRes.count || 0;
    const unscoredMatches = unscoredRes.count || 0;
    const scoredMatches = totalMatches - unscoredMatches;
    const scoresCalculated = (scoresRes.count || 0) > 0;

    return NextResponse.json({
      hasCurrentGw: true,
      gwId,
      gwName: currentGw.name || `Gameweek ${gwId}`,
      deadline: currentGw.deadline_time,
      finalized: !!currentGw.finalized,
      totalMatches,
      scoredMatches,
      unscoredMatches,
      allScoresEntered: totalMatches > 0 && unscoredMatches === 0,
      scoresCalculated,
      usersPicked: uniquePickers,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to load GW status" }, { status: 500 });
  }
}
