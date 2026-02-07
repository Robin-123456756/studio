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

      // Fetch teams for these players
      const teamIds = [...new Set((playersData ?? []).map((p: any) => p.team_id).filter(Boolean))];
      let teamsMap = new Map<number, any>();

      if (teamIds.length > 0) {
        const { data: teamsData } = await supabase
          .from("teams")
          .select("id, team_uuid, name, short_name, logo_url")
          .in("id", teamIds);

        for (const t of teamsData ?? []) {
          teamsMap.set(t.id, t);
        }
      }

      for (const p of playersData ?? []) {
        const team = teamsMap.get(p.team_id);
        playersMap.set(p.id, { ...p, team });
      }
    }

    // 3. Map response
    const stats = (data ?? []).map((s: any) => {
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

    return NextResponse.json({ stats });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
