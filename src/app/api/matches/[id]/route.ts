import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type MatchEvent = {
  playerName: string;
  playerId: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  isLady: boolean;
};

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const matchId = Number(id);
    if (!Number.isFinite(matchId)) {
      return NextResponse.json({ error: "Invalid match id" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();

    // 1. Fetch single match
    const { data: match, error } = await supabase
      .from("matches")
      .select(
        "id, gameweek_id, kickoff_time, home_goals, away_goals, is_played, is_final, home_team_uuid, away_team_uuid"
      )
      .eq("id", matchId)
      .single();

    if (error || !match) {
      return NextResponse.json({ error: "Match not found" }, { status: 404 });
    }

    // 2. Resolve teams
    const teamUuids = [match.home_team_uuid, match.away_team_uuid].filter(Boolean);
    const { data: teams } = teamUuids.length > 0
      ? await supabase
          .from("teams")
          .select("team_uuid, name, short_name, logo_url")
          .in("team_uuid", teamUuids)
      : { data: [] };

    const teamMap = new Map<string, any>();
    for (const t of teams ?? []) teamMap.set(t.team_uuid, t);

    // 3. Resolve gameweek
    const { data: gw } = match.gameweek_id
      ? await supabase
          .from("gameweeks")
          .select("id, name")
          .eq("id", match.gameweek_id)
          .single()
      : { data: null };

    // 4. Enrich with player_match_events
    const { data: rawEvents } = await supabase
      .from("player_match_events")
      .select("match_id, player_id, action, quantity")
      .eq("match_id", matchId);

    const playerInfoMap = new Map<string, any>();
    let home_events: MatchEvent[] = [];
    let away_events: MatchEvent[] = [];

    if (rawEvents && rawEvents.length > 0) {
      const playerIds = [...new Set(rawEvents.map((e: any) => e.player_id))];
      const { data: playersData } = await supabase
        .from("players")
        .select(
          "id, name, web_name, is_lady, team_id, teams:teams!players_team_id_fkey (team_uuid)"
        )
        .in("id", playerIds);

      for (const p of playersData ?? []) playerInfoMap.set(p.id, p);

      const eventMap = new Map<string, MatchEvent>();

      for (const e of rawEvents) {
        if (!eventMap.has(e.player_id)) {
          const p = playerInfoMap.get(e.player_id);
          eventMap.set(e.player_id, {
            playerId: e.player_id,
            playerName: p?.web_name ?? p?.name ?? "Unknown",
            goals: 0,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
            ownGoals: 0,
            isLady: p?.is_lady ?? false,
          });
        }

        const entry = eventMap.get(e.player_id)!;
        const qty = Number(e.quantity ?? 1);
        const act = (e.action ?? "").toLowerCase();
        if (act === "goal") entry.goals += qty;
        else if (act === "assist") entry.assists += qty;
        else if (act === "yellow_card" || act === "yellow") entry.yellowCards += qty;
        else if (act === "red_card" || act === "red") entry.redCards += qty;
        else if (act === "own_goal") entry.ownGoals += qty;
      }

      // Split into home/away
      for (const ev of eventMap.values()) {
        const p = playerInfoMap.get(ev.playerId);
        const pTeamUuid = p?.teams?.team_uuid ?? null;
        if (pTeamUuid === match.home_team_uuid) home_events.push(ev);
        else if (pTeamUuid === match.away_team_uuid) away_events.push(ev);
        else home_events.push(ev); // fallback
      }
    }

    return NextResponse.json({
      match: {
        id: String(match.id),
        gameweek_id: match.gameweek_id,
        kickoff_time: match.kickoff_time,
        home_goals: match.home_goals ?? null,
        away_goals: match.away_goals ?? null,
        is_played: Boolean(match.is_played),
        is_final: Boolean(match.is_final),
        home_team: teamMap.get(match.home_team_uuid) ?? null,
        away_team: teamMap.get(match.away_team_uuid) ?? null,
        gameweek: gw ?? null,
        home_events,
        away_events,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed" },
      { status: 500 }
    );
  }
}
