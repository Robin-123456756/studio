import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { gameweekId } = await request.json();

    if (!gameweekId) {
      return NextResponse.json({ error: "gameweekId is required" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();

    // Get detailed breakdown
    const { data: breakdown, error: breakdownError } = await supabase
      .rpc("calculate_gameweek_scores", { gw_id: gameweekId });

    if (breakdownError) throw breakdownError;

    // Finalize scores into user_weekly_scores
    const { error: finalizeError } = await supabase
      .rpc("finalize_gameweek_scores", { gw_id: gameweekId });

    if (finalizeError) throw finalizeError;

    // Refresh materialized view after score calculation
    try {
      await supabase.rpc("refresh_match_totals");
    } catch (_) {
      // Non-fatal — trigger may have already refreshed it
    }

    // Get summary
    const { data: scores } = await supabase
      .from("user_weekly_scores")
      .select("user_id, total_weekly_points")
      .eq("gameweek_id", gameweekId)
      .order("total_weekly_points", { ascending: false });

    return NextResponse.json({
      success: true,
      gameweekId,
      breakdown,
      leaderboard: scores,
      message: `Scores calculated for ${scores?.length || 0} users in GW${gameweekId}`,
    });
  } catch (error: any) {
    console.error("Score calculation error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}