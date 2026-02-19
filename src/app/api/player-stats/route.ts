import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);

    const gwId = url.searchParams.get("gw_id");
    const playerId = url.searchParams.get("player_id");

    // 1. Fetch player_stats (flat, no FK joins)
    let query = supabase
      .from("player_stats")
      .select(
        `id, player_id, gameweek_id, points, goals, assists,
         clean_sheet, yellow_cards, red_cards, own_goals, player_name, created_at`
      )
      .order("gameweek_id", { ascending: true });

    if (gwId) query = query.eq("gameweek_id", Number(gwId));
    if (playerId) query = query.eq("player_id", playerId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    // 2. Fetch players + teams separately for enrichment
    const playerIds = [...new Set((data ?? []).map((s: any) => s.player_id))];
    let playersMap = new Map<string, any>();

    if (playerIds.length > 0) {
      const { data: playersData } = await supabase
        .from("players")
        .select("id, name, web_name, position, is_lady, avatar_url, team_id")
        .in("id", playerIds);

      // Fetch teams for these players (team_id stores UUIDs matching teams.team_uuid)
      const teamUuids = [...new Set((playersData ?? []).map((p: any) => p.team_id).filter(Boolean))];
      let teamsMap = new Map<string, any>();

      if (teamUuids.length > 0) {
        const { data: teamsData } = await supabase
          .from("teams")
          .select("id, team_uuid, name, short_name, logo_url")
          .in("team_uuid", teamUuids);

        for (const t of teamsData ?? []) {
          teamsMap.set(t.team_uuid, t);
        }
      }

      for (const p of playersData ?? []) {
        const team = teamsMap.get(p.team_id);
        playersMap.set(p.id, { ...p, team });
      }
    }

    // 3. Map response
    const stats: any[] = (data ?? []).map((s: any) => {
      const p = playersMap.get(s.player_id);
      return {
        id: s.id,
        playerId: s.player_id,
        gameweekId: s.gameweek_id,
        points: s.points ?? 0,
        goals: s.goals ?? 0,
        assists: s.assists ?? 0,
        cleanSheet: s.clean_sheet ?? false,
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

    // 4. Derive GK clean sheets from played match results
    //    If a team conceded 0 goals, their goalkeeper(s) get a clean sheet.
    let matchesQ = supabase
      .from("matches")
      .select("id, gameweek_id, home_team_uuid, away_team_uuid, home_goals, away_goals")
      .or("is_played.eq.true,is_final.eq.true");
    if (gwId) matchesQ = matchesQ.eq("gameweek_id", Number(gwId));
    const { data: playedMatches } = await matchesQ;

    const csEvents: { teamUuid: string; gameweekId: number; matchId: number }[] = [];
    for (const m of playedMatches ?? []) {
      // Away scored 0 → home team kept a clean sheet
      if ((m.away_goals ?? 0) === 0 && m.home_team_uuid) {
        csEvents.push({ teamUuid: m.home_team_uuid, gameweekId: m.gameweek_id, matchId: m.id });
      }
      // Home scored 0 → away team kept a clean sheet
      if ((m.home_goals ?? 0) === 0 && m.away_team_uuid) {
        csEvents.push({ teamUuid: m.away_team_uuid, gameweekId: m.gameweek_id, matchId: m.id });
      }
    }

    if (csEvents.length > 0) {
      // Fetch all GK players with team info via FK join
      const { data: gkPlayers } = await supabase
        .from("players")
        .select(
          "id, name, web_name, position, is_lady, avatar_url, team_id, teams:teams!players_team_id_fkey (id, team_uuid, name, short_name, logo_url)"
        )
        .in("position", ["Goalkeeper", "GK", "keeper"]);

      // Group GKs by their team_uuid
      const gkByTeamUuid = new Map<string, any[]>();
      for (const gk of gkPlayers ?? []) {
        const teamUuid = (gk as any).teams?.team_uuid;
        if (!teamUuid) continue;
        if (!gkByTeamUuid.has(teamUuid)) gkByTeamUuid.set(teamUuid, []);
        gkByTeamUuid.get(teamUuid)!.push(gk);
      }

      // Track existing clean sheet entries to avoid duplicates
      const existingCsKeys = new Set(
        stats.filter((s: any) => s.cleanSheet).map((s: any) => `${s.playerId}__${s.gameweekId}`)
      );

      for (const ev of csEvents) {
        const gks = gkByTeamUuid.get(ev.teamUuid) ?? [];
        for (const gk of gks) {
          const key = `${gk.id}__${ev.gameweekId}`;
          if (existingCsKeys.has(key)) continue;
          if (playerId && gk.id !== playerId) continue;
          existingCsKeys.add(key);

          const team = (gk as any).teams;
          stats.push({
            id: `cs-${ev.matchId}-${gk.id}`,
            playerId: gk.id,
            gameweekId: ev.gameweekId,
            points: 0,
            goals: 0,
            assists: 0,
            cleanSheet: true,
            yellowCards: 0,
            redCards: 0,
            ownGoals: 0,
            playerName: gk.web_name ?? gk.name ?? "—",
            player: {
              id: gk.id,
              name: gk.name,
              webName: gk.web_name ?? null,
              position: gk.position ?? null,
              isLady: gk.is_lady ?? false,
              avatarUrl: gk.avatar_url ?? null,
              teamName: team?.name ?? null,
              teamShort: team?.short_name ?? null,
              teamUuid: team?.team_uuid ?? null,
              logoUrl: team?.logo_url ?? null,
            },
          });
        }
      }
    }

    // 5. Derive yellow/red cards from player_match_events
    //    Voice admin stores cards as actions ("yellow", "red") in player_match_events.
    //    Merge these into stats so the matches page can show discipline leaders.
    let eventsQ = supabase
      .from("player_match_events")
      .select("player_id, match_id, action, quantity")
      .in("action", ["yellow", "red", "yellow_card", "red_card"]);
    if (playerId) eventsQ = eventsQ.eq("player_id", playerId);
    const { data: cardEvents } = await eventsQ;

    if (cardEvents && cardEvents.length > 0) {
      // Fetch any players from card events not already in playersMap
      const cardPlayerIds = [...new Set(cardEvents.map((e: any) => e.player_id))];
      const missingPlayerIds = cardPlayerIds.filter((id: string) => !playersMap.has(id));
      if (missingPlayerIds.length > 0) {
        const { data: extraPlayers } = await supabase
          .from("players")
          .select("id, name, web_name, position, is_lady, avatar_url, team_id")
          .in("id", missingPlayerIds);
        const extraTeamUuids = [...new Set((extraPlayers ?? []).map((p: any) => p.team_id).filter(Boolean))];
        let extraTeamsMap = new Map<string, any>();
        if (extraTeamUuids.length > 0) {
          const { data: extraTeams } = await supabase
            .from("teams")
            .select("id, team_uuid, name, short_name, logo_url")
            .in("team_uuid", extraTeamUuids);
          for (const t of extraTeams ?? []) extraTeamsMap.set(t.team_uuid, t);
        }
        for (const p of extraPlayers ?? []) {
          const team = extraTeamsMap.get(p.team_id);
          playersMap.set(p.id, { ...p, team });
        }
      }

      // Get match → gameweek mapping from already-fetched playedMatches + any remaining
      const matchGwMap = new Map<number, number>();
      for (const m of playedMatches ?? []) {
        matchGwMap.set(m.id, m.gameweek_id);
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
          // Merge into existing stat row
          if (isYellow) existing.yellowCards = (existing.yellowCards || 0) + qty;
          if (isRed) existing.redCards = (existing.redCards || 0) + qty;
        } else {
          // Create a new stat entry for this player+gameweek
          const p = playersMap.get(ev.player_id);
          const newStat = {
            id: `card-${ev.match_id}-${ev.player_id}`,
            playerId: ev.player_id,
            gameweekId,
            points: 0,
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
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
