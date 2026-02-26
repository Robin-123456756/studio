import { NextResponse } from "next/server";
import { processTextInput } from "@/lib/voice-admin/pipeline";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text, matchId } = body;
    if (!text || !matchId) {
      return NextResponse.json({ error: "text and matchId are required" }, { status: 400 });
    }
    const supabase = getSupabaseServerOrThrow();
    const { data: match } = await supabase
      .from("matches")
      .select("id, home_team_uuid, away_team_uuid")
      .eq("id", matchId)
      .single();
    if (!match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // Fetch player names for GPT interpretation
    const teamUuids = [match.home_team_uuid, match.away_team_uuid].filter(Boolean);
    let playerNames: string[] = [];
    if (teamUuids.length > 0) {
      const { data: players } = await supabase
        .from("players")
        .select("name, web_name")
        .in("team_id", teamUuids);
      for (const p of players ?? []) {
        if (p.name) playerNames.push(p.name);
        if (p.web_name && p.web_name !== p.name) playerNames.push(p.web_name);
      }
    }

    const result = await processTextInput(text, parseInt(matchId), playerNames);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
