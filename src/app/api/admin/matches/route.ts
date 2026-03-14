import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

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
      return apiError("Failed to schedule match", "MATCH_CREATE_FAILED", 500, error);
    }

    return NextResponse.json({ match: data });
  } catch (e: unknown) {
    return apiError("Failed to schedule match", "MATCH_CREATE_FAILED", 500, e);
  }
}
