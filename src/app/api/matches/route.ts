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
        home_team_uid,
        away_team_uid
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

    const rows = data ?? [];
    const teamIds = Array.from(
      new Set(
        rows
          .flatMap((m: any) => [m.home_team_uid, m.away_team_uid])
          .filter(Boolean)
      )
    );

    const { data: teams, error: teamsErr } =
      teamIds.length > 0
        ? await supabase
            .from("teams")
            .select("team_uuid,name,short_name,logo_url")
            .in("team_uuid", teamIds)
        : { data: [], error: null };

    if (teamsErr) {
      return NextResponse.json({ error: teamsErr.message, details: teamsErr }, { status: 500 });
    }

    const teamMap = new Map<string, any>();
    for (const t of teams ?? []) teamMap.set(t.team_uuid, t);

    // Optionally fetch player_stats for enrichment (separate queries, no FK joins)
    let statsMap = new Map<string, any[]>();
    if (enrich) {
      // Fetch flat player_stats for this gameweek
      const { data: statsData } = await supabase
        .from("player_stats")
        .select("player_id, goals, assists, yellow_cards, red_cards, own_goals, player_name")
        .eq("gameweek_id", gwId);

      // Fetch players to get team_id and is_lady
      const statPlayerIds = [...new Set((statsData ?? []).map((s: any) => s.player_id))];
      const playersLookup = new Map<string, any>();

      if (statPlayerIds.length > 0) {
        const { data: playersData } = await supabase
          .from("players")
          .select("id, name, is_lady, team_id")
          .in("id", statPlayerIds);

        // Fetch teams to map team_id → team_uuid
        const teamIds = [...new Set((playersData ?? []).map((p: any) => p.team_id).filter(Boolean))];
        const teamIdToUuid = new Map<number, string>();

        if (teamIds.length > 0) {
          const { data: teamsData } = await supabase
            .from("teams")
            .select("id, team_uuid")
            .in("id", teamIds);

          for (const t of teamsData ?? []) {
            teamIdToUuid.set(t.id, t.team_uuid);
          }
        }

        for (const p of playersData ?? []) {
          playersLookup.set(p.id, { ...p, teamUuid: teamIdToUuid.get(p.team_id) ?? null });
        }
      }

      // Group stats by team_uuid
      const statsByTeam = new Map<string, any[]>();
      for (const s of statsData ?? []) {
        const player = playersLookup.get(s.player_id);
        const tUuid = player?.teamUuid;
        if (!tUuid) continue;
        if (!statsByTeam.has(tUuid)) statsByTeam.set(tUuid, []);
        statsByTeam.get(tUuid)!.push({ ...s, _player: player });
      }
      statsMap = statsByTeam;
    }

    function buildEvents(teamStats: any[]) {
      return teamStats
        .filter((s: any) => s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_cards > 0 || s.own_goals > 0)
        .map((s: any) => ({
          playerName: s.player_name ?? s._player?.name ?? "—",
          playerId: s.player_id,
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          yellowCards: s.yellow_cards ?? 0,
          redCards: s.red_cards ?? 0,
          ownGoals: s.own_goals ?? 0,
          isLady: s._player?.is_lady ?? false,
        }));
    }

    // ✅ normalize output for UI
    const matches = rows.map((m: any) => {
      const base = {
        ...m,
        id: String(m.id),
        gameweek_id: Number(m.gameweek_id),
        home_goals: m.home_goals == null ? null : Number(m.home_goals),
        away_goals: m.away_goals == null ? null : Number(m.away_goals),
        is_played: m.is_played == null ? null : Boolean(m.is_played),
        is_final: m.is_final == null ? null : Boolean(m.is_final),
        home_team_uuid: String(m.home_team_uid),
        away_team_uuid: String(m.away_team_uid),
        home_team: teamMap.get(m.home_team_uid) ?? null,
        away_team: teamMap.get(m.away_team_uid) ?? null,
      };

      if (enrich) {
        const homeStats = statsMap.get(String(m.home_team_uid)) ?? [];
        const awayStats = statsMap.get(String(m.away_team_uid)) ?? [];
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
