import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);
    const q = (url.searchParams.get("q") ?? "").trim();

    if (q.length < 2) {
      return NextResponse.json({ teams: [], players: [], matches: [] });
    }

    // Teams
    const teamsQ = supabase
      .from("teams")
      .select("team_uuid,name,short_name,logo_url")
      .ilike("name", `%${q}%`)
      .limit(8);

    // Players
    const playersQ = supabase
      .from("players")
      .select("id,name,web_name,position,avatar_url,team_id, teams:teams!players_team_id_fkey(name,short_name,team_uuid)")
      .or(`name.ilike.%${q}%,web_name.ilike.%${q}%`)
      .limit(12);

    // Matches (optional): search by team names through the joined teams
    const matchesQ = supabase
      .from("matches")
      .select(`
        id,gameweek_id,kickoff_time,home_goals,away_goals,is_played,is_final,
        home_team:teams!matches_home_team_uuid_fkey(team_uuid,name,short_name,logo_url),
        away_team:teams!matches_away_team_uuid_fkey(team_uuid,name,short_name,logo_url)
      `)
      .order("kickoff_time", { ascending: false })
      .limit(10);

    const [{ data: teams }, { data: players }, { data: matches }] = await Promise.all([
      teamsQ,
      playersQ,
      matchesQ,
    ]);

    // Filter matches in JS by team name (simple + reliable)
    const matchesFiltered =
      (matches ?? []).filter((m: any) => {
        const hn = (m.home_team?.name ?? "").toLowerCase();
        const an = (m.away_team?.name ?? "").toLowerCase();
        return hn.includes(q.toLowerCase()) || an.includes(q.toLowerCase());
      }) ?? [];

    return NextResponse.json({
      teams: teams ?? [],
      players: players ?? [],
      matches: matchesFiltered,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Search route crashed" },
      { status: 500 }
    );
  }
}
