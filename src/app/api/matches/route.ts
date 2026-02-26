import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);

    const gwIdRaw = url.searchParams.get("gw_id");
    const gwId = gwIdRaw ? Number(gwIdRaw) : NaN;

    const playedParam = url.searchParams.get("played"); // "1" or "0"
    const teamUuid = url.searchParams.get("team_uuid");
    const enrich = url.searchParams.get("enrich") === "1";

    if (!Number.isFinite(gwId)) {
      return NextResponse.json(
        { error: "gw_id is required and must be a number, e.g. /api/matches?gw_id=2" },
        { status: 400 }
      );
    }

    let query = supabase
      .from("matches")
      .select(`
        id,
        gameweek_id,
        kickoff_time,
        home_goals,
        away_goals,
        is_played,
        is_final,
        home_team_uuid,
        away_team_uuid
      `)
      .eq("gameweek_id", gwId)
      .order("kickoff_time", { ascending: true });

    // played filter
    if (playedParam === "1") query = query.eq("is_played", true);
    if (playedParam === "0") query = query.or("is_played.eq.false,is_played.is.null");

    // team filter (home OR away)
    if (teamUuid) {
      query = query.or(`home_team_uuid.eq.${teamUuid},away_team_uuid.eq.${teamUuid}`);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message, details: error }, { status: 500 });

    const rows = data ?? [];
    const teamIds = Array.from(
      new Set(rows.flatMap((m: any) => [m.home_team_uuid, m.away_team_uuid]).filter(Boolean))
    );

    const { data: teams, error: teamsErr } =
      teamIds.length > 0
        ? await supabase
            .from("teams")
            .select("team_uuid,name,short_name,logo_url")
            .in("team_uuid", teamIds)
        : { data: [], error: null };

    if (teamsErr) return NextResponse.json({ error: teamsErr.message, details: teamsErr }, { status: 500 });

    const teamMap = new Map<string, any>();
    for (const t of teams ?? []) teamMap.set(t.team_uuid, t);

    // Enrich with goal scorers / assists from player_match_events
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
    const eventsByMatch = new Map<number, Map<string, MatchEvent>>();
    const playerInfoMap = new Map<string, any>();

    if (enrich && rows.length > 0) {
      const matchIds = rows.map((m: any) => m.id);
      const { data: rawEvents } = await supabase
        .from("player_match_events")
        .select("match_id, player_id, action, quantity")
        .in("match_id", matchIds);

      if (rawEvents && rawEvents.length > 0) {
        // Fetch player info for names + team + is_lady
        const playerIds = [...new Set(rawEvents.map((e: any) => e.player_id))];
        const { data: playersData } = await supabase
          .from("players")
          .select("id, name, web_name, is_lady, team_id, teams:teams!players_team_id_fkey (team_uuid)")
          .in("id", playerIds);

        for (const p of playersData ?? []) playerInfoMap.set(p.id, p);

        for (const e of rawEvents) {
          if (!eventsByMatch.has(e.match_id)) eventsByMatch.set(e.match_id, new Map());
          const matchMap = eventsByMatch.get(e.match_id)!;

          if (!matchMap.has(e.player_id)) {
            const p = playerInfoMap.get(e.player_id);
            matchMap.set(e.player_id, {
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

          const entry = matchMap.get(e.player_id)!;
          const qty = Number(e.quantity ?? 1);
          const act = (e.action ?? "").toLowerCase();
          if (act === "goal") entry.goals += qty;
          else if (act === "assist") entry.assists += qty;
          else if (act === "yellow_card" || act === "yellow") entry.yellowCards += qty;
          else if (act === "red_card" || act === "red") entry.redCards += qty;
          else if (act === "own_goal") entry.ownGoals += qty;
        }
      }
    }

    const matches = rows.map((m: any) => {
      const homeTeamUuid = m.home_team_uuid;
      const awayTeamUuid = m.away_team_uuid;
      const matchEvents = eventsByMatch.get(m.id);

      let home_events: MatchEvent[] | undefined;
      let away_events: MatchEvent[] | undefined;

      if (matchEvents) {
        home_events = [];
        away_events = [];
        for (const ev of matchEvents.values()) {
          const p = playerInfoMap.get(ev.playerId);
          const pTeamUuid = p?.teams?.team_uuid ?? null;
          if (pTeamUuid === homeTeamUuid) home_events.push(ev);
          else if (pTeamUuid === awayTeamUuid) away_events.push(ev);
          else home_events.push(ev); // fallback
        }
      }

      return {
        ...m,
        id: String(m.id),
        gameweek_id: Number(m.gameweek_id),
        home_goals: m.home_goals == null ? null : Number(m.home_goals),
        away_goals: m.away_goals == null ? null : Number(m.away_goals),
        is_played: m.is_played == null ? null : Boolean(m.is_played),
        is_final: m.is_final == null ? null : Boolean(m.is_final),
        home_team: teamMap.get(m.home_team_uuid) ?? null,
        away_team: teamMap.get(m.away_team_uuid) ?? null,
        home_events,
        away_events,
      };
    });

    return NextResponse.json(
      { matches },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
