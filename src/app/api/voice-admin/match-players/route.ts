import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

/**
 * GET /api/voice-admin/match-players?matchId=31
 * Returns all players for both teams in a match, grouped by home/away.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get("matchId");

    if (!matchId) {
      return NextResponse.json({ error: "matchId query parameter required" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();

    // 1. Get match with team UUIDs
    const { data: match, error: matchErr } = await supabase
      .from("matches")
      .select("id, home_team_uuid, away_team_uuid")
      .eq("id", parseInt(matchId))
      .single();

    if (matchErr || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // 2. Fetch team names
    const { data: teams } = await supabase
      .from("teams")
      .select("team_uuid, name, short_name")
      .in("team_uuid", [match.home_team_uuid, match.away_team_uuid]);

    const teamMap: Record<string, { name: string; short_name: string }> = {};
    for (const t of teams || []) {
      teamMap[t.team_uuid] = { name: t.name, short_name: t.short_name };
    }

    // 3. Fetch players for both teams
    const { data: players, error: playerErr } = await supabase
      .from("players")
      .select("id, name, web_name, position, is_lady, team_id")
      .in("team_id", [match.home_team_uuid, match.away_team_uuid])
      .order("position")
      .order("name");

    if (playerErr) throw new Error(`Failed to fetch players: ${playerErr.message}`);

    // 4. Group by team
    const homePlayers = (players || []).filter((p: any) => p.team_id === match.home_team_uuid);
    const awayPlayers = (players || []).filter((p: any) => p.team_id === match.away_team_uuid);

    // Position sort order: GKP first, then DEF, MID, FWD
    const posOrder: Record<string, number> = { Goalkeeper: 0, Defender: 1, Midfielder: 2, Forward: 3 };
    const sortPlayers = (list: any[]) =>
      list.sort((a, b) => (posOrder[a.position] ?? 9) - (posOrder[b.position] ?? 9) || a.name.localeCompare(b.name));

    return NextResponse.json({
      homeTeam: {
        name: teamMap[match.home_team_uuid]?.name || "Home",
        short_name: teamMap[match.home_team_uuid]?.short_name || "HOM",
        players: sortPlayers(homePlayers),
      },
      awayTeam: {
        name: teamMap[match.away_team_uuid]?.name || "Away",
        short_name: teamMap[match.away_team_uuid]?.short_name || "AWY",
        players: sortPlayers(awayPlayers),
      },
    });
  } catch (error: any) {
    console.error("[MatchPlayers] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch match players", message: error.message },
      { status: 500 }
    );
  }
}
