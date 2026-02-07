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

    let query = supabase
      .from("player_stats")
      .select(
        `
        id,
        player_id,
        gameweek_id,
        points,
        goals,
        assists,
        clean_sheet,
        yellow_cards,
        red_cards,
        own_goals,
        player_name,
        created_at,
        players:player_id (
          id,
          name,
          web_name,
          position,
          is_lady,
          avatar_url,
          team_id,
          teams:teams!players_team_id_fkey (
            team_uuid,
            name,
            short_name,
            logo_url
          )
        )
      `
      )
      .order("gameweek_id", { ascending: true });

    if (gwId) query = query.eq("gameweek_id", Number(gwId));
    if (playerId) query = query.eq("player_id", playerId);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    const stats = (data ?? []).map((s: any) => ({
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
      playerName: s.player_name ?? s.players?.name ?? "—",
      player: s.players
        ? {
            id: s.players.id,
            name: s.players.name,
            webName: s.players.web_name ?? null,
            position: s.players.position ?? null,
            isLady: s.players.is_lady ?? false,
            avatarUrl: s.players.avatar_url ?? null,
            teamName: s.players.teams?.name ?? null,
            teamShort: s.players.teams?.short_name ?? null,
            teamUuid: s.players.teams?.team_uuid ?? null,
            logoUrl: s.players.teams?.logo_url ?? null,
          }
        : null,
    }));

    return NextResponse.json({ stats });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
