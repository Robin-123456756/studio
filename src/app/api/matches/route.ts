import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { loadScoringRules, lookupPoints } from "@/lib/scoring-engine";

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
        is_half_time,
        minutes,
        home_team_uuid,
        away_team_uuid,
        venue
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
    if (error) return apiError("Failed to fetch matches", "MATCHES_FETCH_FAILED", 500, error);

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

    if (teamsErr) return apiError("Failed to fetch teams for matches", "MATCHES_TEAMS_FETCH_FAILED", 500, teamsErr);

    const teamMap = new Map<string, any>();
    for (const t of teams ?? []) teamMap.set(t.team_uuid, t);

    // Enrich with goal scorers / assists from player_match_events
    type MatchEvent = {
      playerName: string;
      playerId: string;
      goals: number;
      penalties: number;
      assists: number;
      yellowCards: number;
      redCards: number;
      ownGoals: number;
      bonus: number;
      isLady: boolean;
      totalPoints: number;
      position: string;
    };
    const eventsByMatch = new Map<number, Map<string, MatchEvent>>();
    const playerInfoMap = new Map<string, any>();

    if (enrich && rows.length > 0) {
      const matchIds = rows.map((m: any) => m.id);
      const rawEvents = await fetchAllRows((from, to) =>
        supabase
          .from("player_match_events")
          .select("match_id, player_id, action, quantity, penalties, points_awarded")
          .in("match_id", matchIds)
          .range(from, to)
      );

      // Load scoring rules for totalPoints calculation
      const scoringRules = await loadScoringRules();

      // Fetch player_stats for appearance-only players (same as /api/matches/[id])
      const gwIds = [...new Set(rows.map((m: any) => m.gameweek_id))];
      const { data: allMatchStats } = gwIds.length > 0
        ? await supabase
            .from("player_stats")
            .select("player_id, gameweek_id, did_play")
            .in("gameweek_id", gwIds)
        : { data: [] };

      // Map gameweek -> set of player IDs who played
      const didPlayByGw = new Map<number, Set<string>>();
      for (const s of allMatchStats ?? []) {
        if (!s.did_play) continue;
        const gwKey = Number(s.gameweek_id);
        if (!didPlayByGw.has(gwKey)) didPlayByGw.set(gwKey, new Set());
        didPlayByGw.get(gwKey)!.add(String(s.player_id));
      }

      // Collect all player IDs from events + stats
      const eventPlayerIds = new Set(rawEvents.map((e: any) => String(e.player_id)));
      const statsPlayerIds = new Set<string>();
      for (const pids of didPlayByGw.values()) {
        for (const pid of pids) statsPlayerIds.add(pid);
      }
      const allPlayerIds = [...new Set([...eventPlayerIds, ...statsPlayerIds])];

      if (allPlayerIds.length > 0) {
        const { data: playersData } = await supabase
          .from("players")
          .select("id, name, web_name, is_lady, position, team_id, teams:teams!players_team_id_fkey (team_uuid)")
          .in("id", allPlayerIds);

        for (const p of playersData ?? []) playerInfoMap.set(p.id, p);
      }

      // Build match -> team UUID map for filtering stats-only players
      const matchTeamMap = new Map<number, { home: string; away: string }>();
      for (const m of rows) {
        matchTeamMap.set(m.id, { home: m.home_team_uuid, away: m.away_team_uuid });
      }

      // Track appearance events per match
      const hasAppearanceEvent = new Map<number, Set<string>>();
      const playedFromEvents = new Map<number, Set<string>>();

      for (const e of rawEvents) {
        if (!eventsByMatch.has(e.match_id)) eventsByMatch.set(e.match_id, new Map());
        const matchMap = eventsByMatch.get(e.match_id)!;

        if (!hasAppearanceEvent.has(e.match_id)) hasAppearanceEvent.set(e.match_id, new Set());
        if (!playedFromEvents.has(e.match_id)) playedFromEvents.set(e.match_id, new Set());

        const pid = String(e.player_id);
        if (!matchMap.has(pid)) {
          const p = playerInfoMap.get(pid);
          matchMap.set(pid, {
            playerId: pid,
            playerName: p?.web_name ?? p?.name ?? "Unknown",
            goals: 0,
            penalties: 0,
            assists: 0,
            yellowCards: 0,
            redCards: 0,
            ownGoals: 0,
            bonus: 0,
            isLady: p?.is_lady ?? false,
            totalPoints: 0,
            position: p?.position ?? "MID",
          });
        }

        const entry = matchMap.get(pid)!;
        const qty = Number(e.quantity ?? 1);
        const act = (e.action ?? "").toLowerCase();
        if (act === "goal") {
          entry.goals += qty;
          entry.penalties += Number(e.penalties ?? 0);
        }
        else if (act === "assist") entry.assists += qty;
        else if (act === "yellow_card" || act === "yellow") entry.yellowCards += qty;
        else if (act === "red_card" || act === "red") entry.redCards += qty;
        else if (act === "own_goal") entry.ownGoals += qty;
        else if (act === "bonus") entry.bonus += Number(e.points_awarded ?? 0);

        if (act === "appearance" || act === "sub_appearance") hasAppearanceEvent.get(e.match_id)!.add(pid);
        playedFromEvents.get(e.match_id)!.add(pid);

        // Calculate points (bonus uses stored points_awarded)
        const pts = act === "bonus"
          ? (e.points_awarded ?? 0) * qty
          : lookupPoints(scoringRules, act, entry.position, entry.isLady) * qty;
        entry.totalPoints += pts;
      }

      // Add appearance points for stats-only players (per match)
      for (const m of rows) {
        const gwPlayed = didPlayByGw.get(Number(m.gameweek_id));
        if (!gwPlayed) continue;

        const teams = matchTeamMap.get(m.id);
        if (!teams) continue;

        if (!eventsByMatch.has(m.id)) eventsByMatch.set(m.id, new Map());
        const matchMap = eventsByMatch.get(m.id)!;
        const matchAppearances = hasAppearanceEvent.get(m.id) ?? new Set();
        const matchPlayed = playedFromEvents.get(m.id) ?? new Set();

        for (const pid of gwPlayed) {
          const p = playerInfoMap.get(pid);
          const pTeamUuid = p?.teams?.team_uuid ?? null;
          // Only include players on this match's teams
          if (pTeamUuid !== teams.home && pTeamUuid !== teams.away) continue;

          if (!matchMap.has(pid)) {
            matchMap.set(pid, {
              playerId: pid,
              playerName: p?.web_name ?? p?.name ?? "Unknown",
              goals: 0,
              penalties: 0,
              assists: 0,
              yellowCards: 0,
              redCards: 0,
              ownGoals: 0,
              bonus: 0,
              isLady: p?.is_lady ?? false,
              totalPoints: 0,
              position: p?.position ?? "MID",
            });
          }

          if (!matchAppearances.has(pid)) {
            const entry = matchMap.get(pid)!;
            const appearancePts = lookupPoints(scoringRules, "appearance", entry.position, entry.isLady);
            entry.totalPoints += appearancePts;
          }
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
        is_half_time: Boolean(m.is_half_time),
        minutes: m.minutes ?? null,
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
  } catch (e: unknown) {
    return apiError("Failed to fetch matches", "MATCHES_FETCH_FAILED", 500, e);
  }
}
