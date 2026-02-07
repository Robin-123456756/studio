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

    // ✅ ASSUMED schema (you can rename to your real table/columns):
    // matches: id, gameweek_id, kickoff_time, home_team_uuid, away_team_uuid, home_score, away_score, status
    const { data, error } = await supabase
      .from("matches")
      .select(
        `
        id,
        gameweek_id,
        kickoff_time,
        home_score,
        away_score,
        status,
        home_team:teams!matches_home_team_uid_fkey ( name, short_name, logo_url ),
        away_team:teams!matches_away_team_uid_fkey ( name, short_name, logo_url )
      `
      )
      .eq("gameweek_id", gwId)
      .order("kickoff_time", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message, details: error }, { status: 500 });
    }

    return NextResponse.json({ results: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
