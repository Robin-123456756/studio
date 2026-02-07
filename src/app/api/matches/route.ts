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

    // (optional) enrichment stays the same, just be sure it uses team_uuid
    // ...

    const matches = rows.map((m: any) => ({
      ...m,
      id: String(m.id),
      gameweek_id: Number(m.gameweek_id),
      home_goals: m.home_goals == null ? null : Number(m.home_goals),
      away_goals: m.away_goals == null ? null : Number(m.away_goals),
      is_played: m.is_played == null ? null : Boolean(m.is_played),
      is_final: m.is_final == null ? null : Boolean(m.is_final),
      home_team: teamMap.get(m.home_team_uuid) ?? null,
      away_team: teamMap.get(m.away_team_uuid) ?? null,
    }));

    return NextResponse.json({ matches });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
