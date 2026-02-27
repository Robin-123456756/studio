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
        .select(
          "id, name, web_name, position, is_lady, avatar_url, team_id, teams:teams!players_team_id_fkey(id, team_uuid, name, short_name, logo_url)"
        )
        .in("id", playerIds);

      for (const p of playersData ?? []) {
        const team = (p as any).teams ?? null;
        playersMap.set(p.id, { ...p, team });
      }
    }

    // 3. Map response (lady players get 2x on points)
    const stats: any[] = (data ?? []).map((s: any) => {
      const p = playersMap.get(s.player_id);
      const isLady = p?.is_lady ?? false;
      const rawPoints = s.points ?? 0;
      return {
        id: s.id,
        playerId: s.player_id,
        gameweekId: s.gameweek_id,
        points: isLady ? rawPoints * 2 : rawPoints,
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
    //    If a team conceded 0 goals, mark their goalkeeper's EXISTING stat row
    //    as a clean sheet — but ONLY if the GK already has a player_stats entry
    //    for that gameweek (meaning they actually played).
    let matchesQ = supabase
      .from("matches")
      .select("id, gameweek_id, home_team_uuid, away_team_uuid, home_goals, away_goals")
      .or("is_played.eq.true,is_final.eq.true");
    if (gwId) matchesQ = matchesQ.eq("gameweek_id", Number(gwId));
    const { data: playedMatches } = await matchesQ;

    // Build a set of teamUuid+gameweekId combos that earned a clean sheet
    const csTeamGws = new Set<string>();
    for (const m of playedMatches ?? []) {
      if ((m.away_goals ?? 0) === 0 && m.home_team_uuid) {
        csTeamGws.add(`${m.home_team_uuid}__${m.gameweek_id}`);
      }
      if ((m.home_goals ?? 0) === 0 && m.away_team_uuid) {
        csTeamGws.add(`${m.away_team_uuid}__${m.gameweek_id}`);
      }
    }

    if (csTeamGws.size > 0) {
      // For each existing GK stat row, check if their team kept a CS that gameweek
      for (const s of stats) {
        if (s.cleanSheet) continue; // already marked
        const pos = s.player?.position;
        if (pos !== "GK" && pos !== "Goalkeeper" && pos !== "keeper") continue;
        const teamUuid = s.player?.teamUuid;
        if (!teamUuid) continue;
        const key = `${teamUuid}__${s.gameweekId}`;
        if (csTeamGws.has(key)) {
          s.cleanSheet = true;
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
          .select(
            "id, name, web_name, position, is_lady, avatar_url, team_id, teams:teams!players_team_id_fkey(id, team_uuid, name, short_name, logo_url)"
          )
          .in("id", missingPlayerIds);
        for (const p of extraPlayers ?? []) {
          const team = (p as any).teams ?? null;
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
          // Only merge if the existing row doesn't already have this card type
          // (player_stats may already include the same data)
          if (isYellow && !existing.yellowCards) existing.yellowCards = qty;
          if (isRed && !existing.redCards) existing.redCards = qty;
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
