import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerOrThrow();

    // Step 1: Fetch matches (include all — admin needs access to any match)
    const { data: matchData, error: matchErr } = await supabase
      .from("matches")
      .select("id, gameweek_id, home_goals, away_goals, is_played, is_final, kickoff_time, home_team_uuid, away_team_uuid")
      .order("gameweek_id", { ascending: false })
      .order("kickoff_time", { ascending: true });

    if (matchErr) throw matchErr;

    // Step 2: Collect all team UUIDs
    const teamUuids = new Set<string>();
    for (const m of matchData || []) {
      if (m.home_team_uuid) teamUuids.add(m.home_team_uuid);
      if (m.away_team_uuid) teamUuids.add(m.away_team_uuid);
    }

    // Step 3: Fetch teams
    const { data: teamData } = await supabase
      .from("teams")
      .select("team_uuid, name, short_name")
      .in("team_uuid", Array.from(teamUuids));

    // Step 4: Build lookup map
    const teamMap: Record<string, { name: string; short_name: string }> = {};
    for (const t of teamData || []) {
      teamMap[t.team_uuid] = { name: t.name, short_name: t.short_name };
    }

    // Step 5: Combine
    const matches = (matchData || []).map((m: any) => ({
      id: m.id,
      gameweek_id: m.gameweek_id,
      home_goals: m.home_goals,
      away_goals: m.away_goals,
      is_played: m.is_played,
      is_final: m.is_final,
      kickoff_time: m.kickoff_time,
      home_team: teamMap[m.home_team_uuid]?.name || "Unknown",
      home_short: teamMap[m.home_team_uuid]?.short_name || "???",
      away_team: teamMap[m.away_team_uuid]?.name || "Unknown",
      away_short: teamMap[m.away_team_uuid]?.short_name || "???",
    }));

    return NextResponse.json({ matches });
  } catch (error: any) {
    console.error("[Data] Fetch matches error:", error);
    return NextResponse.json(
      { error: "Failed to fetch matches", message: error.message },
      { status: 500 }
    );
  }
}