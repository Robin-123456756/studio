import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;
    const supabase = getSupabaseServerOrThrow();

    // Step 1: Fetch matches (include all — admin needs access to any match)
    const { data: matchData, error: matchErr } = await supabase
      .from("matches")
      .select("id, gameweek_id, home_goals, away_goals, is_played, is_final, is_half_time, minutes, kickoff_time, started_at, home_team_uuid, away_team_uuid")
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
      is_half_time: m.is_half_time ?? false,
      minutes: m.minutes ?? null,
      started_at: m.started_at ?? null,
      kickoff_time: m.kickoff_time,
      home_team: teamMap[m.home_team_uuid]?.name || "Unknown",
      home_short: teamMap[m.home_team_uuid]?.short_name || "???",
      away_team: teamMap[m.away_team_uuid]?.name || "Unknown",
      away_short: teamMap[m.away_team_uuid]?.short_name || "???",
    }));

    return NextResponse.json({ matches });
  } catch (error: unknown) {
    return apiError("Failed to fetch matches", "MATCHES_FETCH_FAILED", 500, error);
  }
}