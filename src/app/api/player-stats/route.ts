import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";
import { fetchAllRows } from "@/lib/fetch-all-rows";
import { loadScoringRules, lookupPoints, norm } from "@/lib/scoring-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);

    const gwId = url.searchParams.get("gw_id");
    const playerId = url.searchParams.get("player_id");

    // 1. Fetch player_stats (base stat rows — goals, assists, cards, etc.)
    let query = supabase
      .from("player_stats")
      .select(
        `id, player_id, gameweek_id, goals, assists,
         clean_sheet, yellow_cards, red_cards, own_goals, player_name, created_at`
      )
      .order("gameweek_id", { ascending: true });

    if (gwId) query = query.eq("gameweek_id", Number(gwId));
    if (playerId) query = query.eq("player_id", playerId);

    const { data, error } = await query;
    if (error) {
      return apiError("Failed to fetch player stats", "PLAYER_STATS_FETCH_FAILED", 500, error);
    }

    // 2. Fetch players + teams for enrichment
    const playerIds = [...new Set((data ?? []).map((s: any) => s.player_id))];
    const playersMap = new Map<string, any>();

    if (playerIds.length > 0) {
      const { data: playersData } = await supabase
        .from("players")
        .select(
          "id, name, web_name, position, is_lady, avatar_url, team_id, teams:teams!players_team_id_fkey(id, team_uuid, name, short_name, logo_url)"
        )
        .in("id", playerIds);

      for (const p of playersData ?? []) {
        const team = (p as any).teams ?? null;
        playersMap.set(p.id, { ...p, team });
      }
    }

    // 3. Fetch played matches for clean sheet derivation + match→GW mapping
    let matchesQ = supabase
      .from("matches")
      .select("id, gameweek_id, home_team_uuid, away_team_uuid, home_goals, away_goals")
      .or("is_played.eq.true,is_final.eq.true");
    if (gwId) matchesQ = matchesQ.eq("gameweek_id", Number(gwId));
    const { data: playedMatches } = await matchesQ;

    const matchGwMap = new Map<number, number>();
    for (const m of playedMatches ?? []) {
      matchGwMap.set(m.id, m.gameweek_id);
    }

    // Build clean sheet sets from ACTUAL match scores (source of truth)
    const csTeamGws = new Set<string>();
    const concededTeamGws = new Set<string>();
    for (const m of playedMatches ?? []) {
      if ((m.away_goals ?? 0) === 0 && m.home_team_uuid) {
        csTeamGws.add(`${m.home_team_uuid}__${m.gameweek_id}`);
      } else if (m.home_team_uuid) {
        concededTeamGws.add(`${m.home_team_uuid}__${m.gameweek_id}`);
      }
      if ((m.home_goals ?? 0) === 0 && m.away_team_uuid) {
        csTeamGws.add(`${m.away_team_uuid}__${m.gameweek_id}`);
      } else if (m.away_team_uuid) {
        concededTeamGws.add(`${m.away_team_uuid}__${m.gameweek_id}`);
      }
    }

    // 4. Fetch ALL player_match_events for these players to compute points
    //    Recalculate from scoring rules (same as fantasy-gw-details) so lady
    //    2x multiplier is always consistent — never rely on stored points_awarded.
    const gwMatchIds = (playedMatches ?? []).map((m: any) => m.id);
    const eventPointsMap = new Map<string, number>(); // key: playerId__gameweekId

    // Also track goals/assists/penalties/bonus from events (source of truth over player_stats)
    const eventGoalsMap = new Map<string, number>();      // key: playerId__gameweekId
    const eventPenaltiesMap = new Map<string, number>();   // key: playerId__gameweekId
    const eventAssistsMap = new Map<string, number>();     // key: playerId__gameweekId
    const eventBonusMap = new Map<string, number>();       // key: playerId__gameweekId

    // Load scoring rules so we recalculate points identically to fantasy-gw-details
    const rules = await loadScoringRules();

    if (gwMatchIds.length > 0 && playerIds.length > 0) {
      const events = await fetchAllRows((from, to) =>
        supabase
          .from("player_match_events")
          .select("player_id, match_id, action, quantity, points_awarded, penalties")
          .in("match_id", gwMatchIds)
          .in("player_id", playerIds)
          .range(from, to)
      );

      for (const e of events) {
        const pid = String(e.player_id);
        const matchGw = matchGwMap.get(e.match_id);
        if (!matchGw) continue;
        const key = `${pid}__${matchGw}`;
        const qty = e.quantity ?? 1;

        // Recalculate from scoring rules + player metadata (position, is_lady)
        // Bonus uses stored points_awarded directly (not in scoring_rules table)
        const meta = playersMap.get(pid);
        const position = norm(meta?.position);
        const isLady = meta?.is_lady ?? false;
        let pts: number;
        if (e.action === "bonus") {
          pts = (e.points_awarded ?? 0) * qty;
        } else {
          pts = lookupPoints(rules, e.action, position, isLady) * qty;
        }
        eventPointsMap.set(key, (eventPointsMap.get(key) ?? 0) + pts);

        if (e.action === "goal") {
          eventGoalsMap.set(key, (eventGoalsMap.get(key) ?? 0) + qty);
          eventPenaltiesMap.set(key, (eventPenaltiesMap.get(key) ?? 0) + (e.penalties ?? 0));
        } else if (e.action === "assist") {
          eventAssistsMap.set(key, (eventAssistsMap.get(key) ?? 0) + qty);
        } else if (e.action === "bonus") {
          eventBonusMap.set(key, (eventBonusMap.get(key) ?? 0) + pts);
        }
      }
    }

    // 5. Build response — points from events, clean sheet from match scores
    const stats: any[] = (data ?? []).map((s: any) => {
      const p = playersMap.get(s.player_id);
      const teamUuid = (p as any)?.team?.team_uuid ?? null;
      const csKey = teamUuid ? `${teamUuid}__${s.gameweek_id}` : "";
      const concededKey = teamUuid ? `${teamUuid}__${s.gameweek_id}` : "";

      // Clean sheet: derive from actual match scores, not stale player_stats
      let cleanSheet = false;
      if (csKey && csTeamGws.has(csKey)) {
        // Team kept a clean sheet — award to GK/DEF/MID
        const pos = p?.position ?? "";
        if (["GK", "Goalkeeper", "keeper", "DEF", "Defender", "MID", "Midfielder"].includes(pos)) {
          cleanSheet = true;
        }
      }
      // If team conceded, NEVER show clean sheet regardless of player_stats value
      if (concededKey && concededTeamGws.has(concededKey)) {
        cleanSheet = false;
      }

      // Points: recalculated from scoring rules (same as fantasy-gw-details)
      // Lady 2x multiplier is applied by lookupPoints() — always consistent
      const evtKey = `${s.player_id}__${s.gameweek_id}`;
      const points = eventPointsMap.get(evtKey) ?? 0;
      const goals = eventGoalsMap.get(evtKey) ?? s.goals ?? 0;
      const penalties = eventPenaltiesMap.get(evtKey) ?? s.penalties ?? 0;
      const assists = eventAssistsMap.get(evtKey) ?? s.assists ?? 0;
      const bonus = eventBonusMap.get(evtKey) ?? 0;

      return {
        id: s.id,
        playerId: s.player_id,
        gameweekId: s.gameweek_id,
        points,
        goals,
        penalties,
        assists,
        bonus,
        cleanSheet,
        yellowCards: s.yellow_cards ?? 0,
        redCards: s.red_cards ?? 0,
        ownGoals: s.own_goals ?? 0,
        playerName: s.player_name ?? p?.name ?? "—",
        player: p
          ? {
              id: p.id,
              name: p.name,
              webName: p.web_name ?? null,
              position: p.position ?? null,
              isLady: p.is_lady ?? false,
              avatarUrl: p.avatar_url ?? null,
              teamName: p.team?.name ?? null,
              teamShort: p.team?.short_name ?? null,
              teamUuid: p.team?.team_uuid ?? null,
              logoUrl: p.team?.logo_url ?? null,
            }
          : null,
      };
    });

    // 6. Merge yellow/red cards from player_match_events
    //    (cards may exist as events but not in player_stats rows)
    const cardEvents = await fetchAllRows((from, to) => {
      let q = supabase
        .from("player_match_events")
        .select("player_id, match_id, action, quantity")
        .in("action", ["yellow", "red", "yellow_card", "red_card"]);
      if (gwMatchIds.length > 0) q = q.in("match_id", gwMatchIds);
      if (playerId) q = q.eq("player_id", playerId);
      return q.range(from, to);
    });

    if (cardEvents.length > 0) {
      // Fetch any players from card events not already in playersMap
      const cardPlayerIds = [...new Set(cardEvents.map((e: any) => e.player_id))];
      const missingPlayerIds = cardPlayerIds.filter((id: string) => !playersMap.has(id));
      if (missingPlayerIds.length > 0) {
        const { data: extraPlayers } = await supabase
          .from("players")
          .select(
            "id, name, web_name, position, is_lady, avatar_url, team_id, teams:teams!players_team_id_fkey(id, team_uuid, name, short_name, logo_url)"
          )
          .in("id", missingPlayerIds);
        for (const p of extraPlayers ?? []) {
          const team = (p as any).teams ?? null;
          playersMap.set(p.id, { ...p, team });
        }
      }

      // Fetch any match IDs we don't already have
      const missingMatchIds = [
        ...new Set(
          cardEvents
            .map((e: any) => e.match_id)
            .filter((id: number) => !matchGwMap.has(id))
        ),
      ];
      if (missingMatchIds.length > 0) {
        const { data: extraMatches } = await supabase
          .from("matches")
          .select("id, gameweek_id")
          .in("id", missingMatchIds);
        for (const m of extraMatches ?? []) {
          matchGwMap.set(m.id, m.gameweek_id);
        }
      }

      // Build a lookup of existing stats by playerId+gameweekId
      const statsLookup = new Map<string, any>();
      for (const s of stats) {
        const key = `${s.playerId}__${s.gameweekId}`;
        statsLookup.set(key, s);
      }

      for (const ev of cardEvents) {
        const gameweekId = matchGwMap.get(ev.match_id);
        if (!gameweekId) continue;
        if (gwId && gameweekId !== Number(gwId)) continue;

        const isYellow = ev.action === "yellow" || ev.action === "yellow_card";
        const isRed = ev.action === "red" || ev.action === "red_card";
        const qty = ev.quantity ?? 1;
        const key = `${ev.player_id}__${gameweekId}`;
        const existing = statsLookup.get(key);

        if (existing) {
          if (isYellow && !existing.yellowCards) existing.yellowCards = qty;
          if (isRed && !existing.redCards) existing.redCards = qty;
        } else {
          const p = playersMap.get(ev.player_id);
          const newStat = {
            id: `card-${ev.match_id}-${ev.player_id}`,
            playerId: ev.player_id,
            gameweekId,
            points: eventPointsMap.get(`${ev.player_id}__${gameweekId}`) ?? 0,
            goals: 0,
            assists: 0,
            cleanSheet: false,
            yellowCards: isYellow ? qty : 0,
            redCards: isRed ? qty : 0,
            ownGoals: 0,
            playerName: p?.web_name ?? p?.name ?? "—",
            player: p
              ? {
                  id: p.id,
                  name: p.name,
                  webName: p.web_name ?? null,
                  position: p.position ?? null,
                  isLady: p.is_lady ?? false,
                  avatarUrl: p.avatar_url ?? null,
                  teamName: p.team?.name ?? null,
                  teamShort: p.team?.short_name ?? null,
                  teamUuid: p.team?.team_uuid ?? null,
                  logoUrl: p.team?.logo_url ?? null,
                }
              : null,
          };
          stats.push(newStat);
          statsLookup.set(key, newStat);
        }
      }
    }

    return NextResponse.json({ stats });
  } catch (e: unknown) {
    return apiError("Failed to fetch player stats", "PLAYER_STATS_FETCH_FAILED", 500, e);
  }
}
