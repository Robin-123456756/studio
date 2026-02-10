import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json({ error: "matchId query parameter required" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();
    const { data, error } = await supabase
      .from("player_match_totals")
      .select("*")
      .eq("match_id", parseInt(matchId))
      .order("total_points", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ totals: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: "Failed to fetch match totals" }, { status: 500 });
  }
}


