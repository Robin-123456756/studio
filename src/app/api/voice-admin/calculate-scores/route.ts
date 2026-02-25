import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { calculateGameweekScores } from "@/lib/scoring-engine";

export async function POST(request: Request) {
  try {
    const { gameweekId } = await request.json();

    if (!gameweekId) {
      return NextResponse.json({ error: "gameweekId is required" }, { status: 400 });
    }

    // Run the TypeScript scoring engine (auto-sub, vice-captain, bench boost)
    const result = await calculateGameweekScores(Number(gameweekId));

    // Refresh materialized view after score calculation
    try {
      const supabase = getSupabaseServerOrThrow();
      await supabase.rpc("refresh_match_totals");
    } catch (_) {
      // Non-fatal — trigger may have already refreshed it
    }

    // Build leaderboard from engine results
    const leaderboard = result.results
      .map((r) => ({ user_id: r.userId, total_weekly_points: r.totalPoints }))
      .sort((a, b) => b.total_weekly_points - a.total_weekly_points);

    return NextResponse.json({
      success: true,
      gameweekId,
      breakdown: result.results.map((r) => ({
        userId: r.userId,
        totalPoints: r.totalPoints,
        autoSubs: r.autoSubs,
        captainActivated: r.captainActivated,
        benchBoost: r.benchBoost,
      })),
      leaderboard,
      message: `Scores calculated for ${result.summary.usersScored} users in GW${gameweekId}`,
    });
  } catch (error: any) {
    console.error("Score calculation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
