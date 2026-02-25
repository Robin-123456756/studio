import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/match-appearances?gw_id=3
 *
 * Returns matches for the GW with players grouped by team,
 * each player annotated with whether they have existing events
 * or a did_play flag, so the admin can mark appearances.
 */
export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);
    const gwIdParam = url.searchParams.get("gw_id");
    const gwId = gwIdParam ? Number(gwIdParam) : NaN;

    if (!Number.isFinite(gwId)) {
      return NextResponse.json({ error: "gw_id is required" }, { status: 400 });
    }

    // 1. Fetch matches for this GW
    const { data: matches, error: matchErr } = await supabase
      .from("matches")
      .select("id, home_team_uuid, away_team_uuid, home_goals, away_goals, is_played, kickoff_time")
      .eq("gameweek_id", gwId)
      .order("kickoff_time", { ascending: true });

    if (matchErr) {
      return NextResponse.json({ error: matchErr.message }, { status: 500 });
    }
    if (!matches || matches.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    // 2. Collect all team UUIDs from matches
    const teamUuids = [
      ...new Set(matches.flatMap((m) => [m.home_team_uuid, m.away_team_uuid].filter(Boolean))),
    ];

    // 3. Fetch teams (UUID → name, short_name, integer id)
    const { data: teams } = await supabase
      .from("teams")
      .select("id, team_uuid, name, short_name")
      .in("team_uuid", teamUuids);

    const teamByUuid = new Map<string, { id: number; team_uuid: string; name: string; short_name: string }>();
    for (const t of teams ?? []) {
      teamByUuid.set(t.team_uuid, t);
    }

    // 4. Fetch players for all teams in these matches (using integer team_id)
    const teamIntIds = [...new Set((teams ?? []).map((t) => t.id))];
    const { data: players } = await supabase
      .from("players")
      .select("id, name, web_name, position, team_id, is_lady")
      .in("team_id", teamIntIds)
      .order("position", { ascending: true });

    // Group players by integer team_id
    const playersByTeamId = new Map<number, typeof players>();
    for (const p of players ?? []) {
      if (!playersByTeamId.has(p.team_id)) playersByTeamId.set(p.team_id, []);
      playersByTeamId.get(p.team_id)!.push(p);
    }

    // 5. Fetch existing player_stats.did_play for this GW
    const allPlayerIds = (players ?? []).map((p) => String(p.id));
    const { data: statsRows } = await supabase
      .from("player_stats")
      .select("player_id, did_play")
      .eq("gameweek_id", gwId)
      .in("player_id", allPlayerIds);

    const didPlayFromStats = new Set<string>();
    for (const s of statsRows ?? []) {
      if (s.did_play) didPlayFromStats.add(String(s.player_id));
    }

    // 6. Fetch player_match_events for this GW's matches (players with events definitely played)
    const matchIds = matches.map((m) => m.id);
    const { data: events } = await supabase
      .from("player_match_events")
      .select("player_id, match_id")
      .in("match_id", matchIds);

    // Map: player_id → set of match_ids where they have events
    const eventsMap = new Map<string, Set<number>>();
    for (const e of events ?? []) {
      const pid = String(e.player_id);
      if (!eventsMap.has(pid)) eventsMap.set(pid, new Set());
      eventsMap.get(pid)!.add(e.match_id);
    }

    // 7. Build response grouped by match → home/away team → players
    const result = matches.map((match) => {
      const homeTeam = teamByUuid.get(match.home_team_uuid);
      const awayTeam = teamByUuid.get(match.away_team_uuid);

      function buildTeamPlayers(team: typeof homeTeam, matchId: number) {
        if (!team) return { teamUuid: null, teamName: "Unknown", shortName: "???", players: [] };
        const teamPlayers = playersByTeamId.get(team.id) ?? [];
        return {
          teamUuid: team.team_uuid,
          teamName: team.name,
          shortName: team.short_name,
          players: teamPlayers.map((p) => {
            const pid = String(p.id);
            const hasEvents = eventsMap.get(pid)?.has(matchId) ?? false;
            const markedDidPlay = didPlayFromStats.has(pid);
            return {
              id: pid,
              name: p.web_name || p.name,
              position: p.position,
              isLady: p.is_lady,
              hasEvents,          // true = has match events (definitely played)
              markedDidPlay,      // true = admin previously marked did_play
              didPlay: hasEvents || markedDidPlay, // combined: pre-check the checkbox
            };
          }),
        };
      }

      return {
        matchId: match.id,
        homeGoals: match.home_goals,
        awayGoals: match.away_goals,
        isPlayed: match.is_played,
        homeTeam: buildTeamPlayers(homeTeam, match.id),
        awayTeam: buildTeamPlayers(awayTeam, match.id),
      };
    });

    return NextResponse.json({ gwId, matches: result });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Route crashed" }, { status: 500 });
  }
}

/**
 * POST /api/admin/match-appearances
 *
 * Body: { gameweekId: number, appearances: { playerId: string, didPlay: boolean }[] }
 *
 * Bulk upserts player_stats.did_play for the given GW.
 */
export async function POST(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const body = await req.json();
    const { gameweekId, appearances } = body as {
      gameweekId: number;
      appearances: { playerId: string; didPlay: boolean }[];
    };

    if (!gameweekId || !Array.isArray(appearances)) {
      return NextResponse.json({ error: "gameweekId and appearances[] required" }, { status: 400 });
    }

    // Upsert player_stats rows with did_play flag
    const rows = appearances.map((a) => ({
      player_id: a.playerId,
      gameweek_id: gameweekId,
      did_play: a.didPlay,
    }));

    if (rows.length > 0) {
      const { error } = await supabase
        .from("player_stats")
        .upsert(rows, { onConflict: "player_id,gameweek_id" });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    const markedCount = appearances.filter((a) => a.didPlay).length;
    return NextResponse.json({
      success: true,
      markedCount,
      totalProcessed: appearances.length,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Route crashed" }, { status: 500 });
  }
}
