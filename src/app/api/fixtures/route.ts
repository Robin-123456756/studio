import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);

    const gwIdRaw = url.searchParams.get("gw_id");
    const statusParam = url.searchParams.get("status");
    const teamUuid = url.searchParams.get("team_uuid");

    let query = supabase
      .from("fixtures")
      .select(
        "id, home_team_uuid, away_team_uuid, gameweek_id, kickoff_time, venue, match_day_label, status, created_at"
      )
      .order("kickoff_time", { ascending: true });

    if (gwIdRaw) {
      const gwId = Number(gwIdRaw);
      if (!Number.isFinite(gwId))
        return NextResponse.json({ error: "gw_id must be a number" }, { status: 400 });
      query = query.eq("gameweek_id", gwId);
    }

    if (statusParam) query = query.eq("status", statusParam);

    if (teamUuid) {
      query = query.or(
        `home_team_uuid.eq.${teamUuid},away_team_uuid.eq.${teamUuid}`
      );
    }

    const { data, error } = await query;
    if (error)
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });

    const rows = data ?? [];

    // Resolve teams
    const teamIds = Array.from(
      new Set(
        rows.flatMap((f: any) => [f.home_team_uuid, f.away_team_uuid]).filter(Boolean)
      )
    );

    const { data: teams, error: teamsErr } =
      teamIds.length > 0
        ? await supabase
            .from("teams")
            .select("team_uuid,name,short_name,logo_url")
            .in("team_uuid", teamIds)
        : { data: [], error: null };

    if (teamsErr)
      return NextResponse.json({ error: teamsErr.message, details: teamsErr }, { status: 500 });

    const teamMap = new Map<string, any>();
    for (const t of teams ?? []) teamMap.set(t.team_uuid, t);

    // Resolve gameweek names
    const gwIds = Array.from(
      new Set(rows.map((f: any) => f.gameweek_id).filter(Boolean))
    );

    const { data: gameweeks } =
      gwIds.length > 0
        ? await supabase.from("gameweeks").select("id, name").in("id", gwIds)
        : { data: [] };

    const gwMap = new Map<number, any>();
    for (const g of gameweeks ?? []) gwMap.set(g.id, g);

    const fixtures = rows.map((f: any) => ({
      id: String(f.id),
      home_team_uuid: f.home_team_uuid,
      away_team_uuid: f.away_team_uuid,
      gameweek_id: Number(f.gameweek_id),
      kickoff_time: f.kickoff_time,
      venue: f.venue ?? "",
      match_day_label: f.match_day_label ?? null,
      status: f.status ?? "scheduled",
      home_team: teamMap.get(f.home_team_uuid) ?? null,
      away_team: teamMap.get(f.away_team_uuid) ?? null,
      gameweek: gwMap.get(f.gameweek_id) ?? null,
    }));

    return NextResponse.json({ fixtures });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
