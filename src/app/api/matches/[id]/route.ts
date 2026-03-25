import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { loadScoringRules, lookupPoints } from "@/lib/scoring-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  avatarUrl: string | null;
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

    // 4. Enrich with player_match_events (include points_awarded for bonus)
    const rawEvents = await fetchAllRows((from, to) =>
      supabase
        .from("player_match_events")
        .select("match_id, player_id, action, quantity, penalties, points_awarded")
        .eq("match_id", matchId)
        .range(from, to)
    );

    // Also fetch player_stats to catch appearance-only players (no events)
    // player_stats uses gameweek_id, not match_id
    const { data: matchStats } = match.gameweek_id
      ? await supabase
          .from("player_stats")
          .select("player_id, did_play")
          .eq("gameweek_id", match.gameweek_id)
      : { data: [] };

    const didPlayFromStats = new Set<string>();
    for (const s of matchStats ?? []) {
      if (s.did_play) didPlayFromStats.add(String(s.player_id));
    }

    // Collect all player IDs from events + stats
    const eventPlayerIds = new Set(rawEvents.map((e: any) => String(e.player_id)));
    const allPlayerIds = [...new Set([...eventPlayerIds, ...didPlayFromStats])];

    const playerInfoMap = new Map<string, any>();
    const home_events: MatchEvent[] = [];
    const away_events: MatchEvent[] = [];

    if (allPlayerIds.length > 0) {
      const { data: playersData } = await supabase
        .from("players")
        .select(
          "id, name, web_name, is_lady, position, avatar_url, team_id, teams:teams!players_team_id_fkey (team_uuid)"
        )
        .in("id", allPlayerIds);

      for (const p of playersData ?? []) playerInfoMap.set(p.id, p);

      // Filter didPlayFromStats to only players on THIS match's teams
      // (player_stats is gameweek-level, so it includes players from other matches)
      for (const pid of didPlayFromStats) {
        const p = playerInfoMap.get(pid);
        const pTeamUuid = p?.teams?.team_uuid ?? null;
        if (pTeamUuid !== match.home_team_uuid && pTeamUuid !== match.away_team_uuid) {
          didPlayFromStats.delete(pid);
        }
      }

      // Load scoring rules for points calculation
      const scoringRules = await loadScoringRules();

      const eventMap = new Map<string, MatchEvent>();
      // Track whether each player already has an appearance event
      const hasAppearanceEvent = new Set<string>();
      const playedFromEvents = new Set<string>();

      for (const e of rawEvents) {
        const pid = String(e.player_id);
        if (!eventMap.has(pid)) {
          const p = playerInfoMap.get(pid);
          eventMap.set(pid, {
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
            avatarUrl: p?.avatar_url ?? null,
          });
        }

        const entry = eventMap.get(pid)!;
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

        if (act === "appearance" || act === "sub_appearance") hasAppearanceEvent.add(pid);
        playedFromEvents.add(pid);

        // Bonus uses stored points_awarded (variable 3/2/1, not in scoring_rules)
        const pts = act === "bonus"
          ? (e.points_awarded ?? 0) * qty
          : lookupPoints(scoringRules, act, entry.position, entry.isLady) * qty;
        entry.totalPoints += pts;
      }

      // Add appearance points for players from player_stats who have no appearance event
      for (const pid of allPlayerIds) {
        const played = playedFromEvents.has(pid) || didPlayFromStats.has(pid);
        if (!played) continue;

        // Ensure an eventMap entry exists for stats-only players
        if (!eventMap.has(pid)) {
          const p = playerInfoMap.get(pid);
          eventMap.set(pid, {
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
            avatarUrl: p?.avatar_url ?? null,
          });
        }

        // Award appearance points if not already counted
        if (!hasAppearanceEvent.has(pid)) {
          const entry = eventMap.get(pid)!;
          const appearancePts = lookupPoints(scoringRules, "appearance", entry.position, entry.isLady);
          entry.totalPoints += appearancePts;
        }
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
  } catch (e: unknown) {
    return apiError("Failed to fetch match details", "MATCH_DETAIL_FETCH_FAILED", 500, e);
  }
}
