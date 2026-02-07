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
      .select(
        `
        id,
        gameweek_id,
        kickoff_time,
        home_goals,
        away_goals,
        is_played,
        is_final,
        home_team_uuid:home_team_uid,
        away_team_uuid:away_team_uid,

        home_team:teams!matches_home_team_uid_fkey (
          team_uuid,
          name,
          short_name,
          logo_url
        ),
        away_team:teams!matches_away_team_uid_fkey (
          team_uuid,
          name,
          short_name,
          logo_url
        )
      `
      )
      .eq("gameweek_id", gwId)
      .order("kickoff_time", { ascending: true });

    // ✅ played filter
    if (playedParam === "1") query = query.eq("is_played", true);
    if (playedParam === "0") query = query.or("is_played.eq.false,is_played.is.null");

    // team filter
    if (teamUuid) {
      query = query.or(`home_team_uid.eq.${teamUuid},away_team_uid.eq.${teamUuid}`);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    // Optionally fetch player_stats for enrichment
    let statsMap = new Map<string, any[]>(); // key: "home" or "away" side per match
    if (enrich) {
      const { data: statsData } = await supabase
        .from("player_stats")
        .select(
          `
          gameweek_id,
          player_id,
          goals,
          assists,
          yellow_cards,
          red_cards,
          own_goals,
          player_name,
          players:player_id (
            name,
            web_name,
            is_lady,
            team_id,
            teams:teams!players_team_id_fkey ( team_uuid )
          )
        `
        )
        .eq("gameweek_id", gwId);

      // Group stats by team_uuid for easy lookup
      const statsByTeam = new Map<string, any[]>();
      for (const s of statsData ?? []) {
        const teamUuid = (s as any).players?.teams?.team_uuid;
        if (!teamUuid) continue;
        if (!statsByTeam.has(teamUuid)) statsByTeam.set(teamUuid, []);
        statsByTeam.get(teamUuid)!.push(s);
      }
      statsMap = statsByTeam;
    }

    function buildEvents(teamStats: any[]) {
      return teamStats
        .filter((s: any) => s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_cards > 0 || s.own_goals > 0)
        .map((s: any) => ({
          playerName: s.player_name ?? s.players?.name ?? "—",
          playerId: s.player_id,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          yellowCards: s.yellow_cards ?? 0,
          redCards: s.red_cards ?? 0,
          ownGoals: s.own_goals ?? 0,
          isLady: s.players?.is_lady ?? false,
        }));
    }

    // ✅ normalize output for UI
    const matches = (data ?? []).map((m: any) => {
      const base = {
        ...m,
        id: String(m.id),
        gameweek_id: Number(m.gameweek_id),
        home_goals: m.home_goals == null ? null : Number(m.home_goals),
        away_goals: m.away_goals == null ? null : Number(m.away_goals),
        is_played: m.is_played == null ? null : Boolean(m.is_played),
        is_final: m.is_final == null ? null : Boolean(m.is_final),
        home_team_uuid: String(m.home_team_uuid),
        away_team_uuid: String(m.away_team_uuid),
      };

      if (enrich) {
        const homeStats = statsMap.get(String(m.home_team_uuid)) ?? [];
        const awayStats = statsMap.get(String(m.away_team_uuid)) ?? [];
        return {
          ...base,
          home_events: buildEvents(homeStats),
          away_events: buildEvents(awayStats),
        };
      }

      return base;
    });

    return NextResponse.json({ matches });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
