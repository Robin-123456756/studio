import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { home_team_uuid, away_team_uuid, gameweek_id, kickoff_time } = body;

    if (!home_team_uuid || !away_team_uuid) {
      return NextResponse.json({ error: "Home and away teams are required." }, { status: 400 });
    }
    if (home_team_uuid === away_team_uuid) {
      return NextResponse.json({ error: "Home and away teams must be different." }, { status: 400 });
    }
    if (!gameweek_id) {
      return NextResponse.json({ error: "Gameweek is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("matches")
      .insert({
        home_team_uuid: home_team_uuid,
        away_team_uuid: away_team_uuid,
        gameweek_id: Number(gameweek_id),
        kickoff_time: kickoff_time || null,
        is_played: false,
        is_final: false,
        home_goals: null,
        away_goals: null,
      })
      .select("id, home_team_uuid, away_team_uuid, gameweek_id, kickoff_time")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ match: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to schedule match" }, { status: 500 });
  }
}
