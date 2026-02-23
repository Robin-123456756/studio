import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Expected table: matches (or fixtures) — adjust names if yours differ
export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);
    const gwId = Number(url.searchParams.get("gw_id"));

    if (!Number.isFinite(gwId)) {
      return NextResponse.json({ error: "gw_id is required" }, { status: 400 });
    }

    // ✅ Using matches + teams (manual join to avoid schema cache FK issues)
    const { data, error } = await supabase
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
        home_team_uuid,
        away_team_uuid
      `
      )
      .eq("gameweek_id", gwId)
      .order("kickoff_time", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    const rows = data ?? [];
    const teamIds = Array.from(
      new Set(
        rows
          .flatMap((m: any) => [m.home_team_uuid, m.away_team_uuid])
          .filter(Boolean)
      )
    );

    const { data: teams } =
      teamIds.length > 0
        ? await supabase
            .from("teams")
            .select("team_uuid,name,short_name,logo_url")
            .in("team_uuid", teamIds)
        : { data: [] };

    const teamMap = new Map<string, any>();
    for (const t of teams ?? []) teamMap.set(t.team_uuid, t);

    const results = rows.map((m: any) => ({
      ...m,
      home_team: teamMap.get(m.home_team_uuid) ?? null,
      away_team: teamMap.get(m.away_team_uuid) ?? null,
    }));

    return NextResponse.json({ results });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
