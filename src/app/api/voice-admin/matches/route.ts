import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const { searchParams } = new URL(request.url);
    const gameweekId = searchParams.get("gameweek_id");

    const query = supabase
      .from("matches")
      .select(`
        id,
        gameweek_id,
        home_goals,
        away_goals,
        is_played,
        is_final,
        kickoff_time
      `)
      .order("gameweek_id", { ascending: false })
      .limit(20);

    const { data, error } = gameweekId
      ? await query.eq("gameweek_id", parseInt(gameweekId))
      : await query;

    if (error) throw error;

    return NextResponse.json({ matches: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}