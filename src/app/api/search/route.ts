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

    // Matches (optional): fetch raw, then attach teams manually
    const matchesQ = supabase
      .from("matches")
      .select(`
        id,gameweek_id,kickoff_time,home_goals,away_goals,is_played,is_final,
        home_team_uuid,away_team_uuid
      `)
      .order("kickoff_time", { ascending: false })
      .limit(10);

    const [{ data: teams }, { data: players }, { data: matches }] = await Promise.all([
      teamsQ,
      playersQ,
      matchesQ,
    ]);

    // Attach team info to matches (no FK join in schema)
    const matchRows = matches ?? [];
    const matchTeamIds = Array.from(
      new Set(
        matchRows
          .flatMap((m: any) => [m.home_team_uuid, m.away_team_uuid])
          .filter(Boolean)
      )
    );

    const { data: matchTeams } =
      matchTeamIds.length > 0
        ? await supabase
            .from("teams")
            .select("team_uuid,name,short_name,logo_url")
            .in("team_uuid", matchTeamIds)
        : { data: [] };

    const teamMap = new Map<string, any>();
    for (const t of matchTeams ?? []) teamMap.set(t.team_uuid, t);

    const matchesWithTeams = matchRows.map((m: any) => ({
      ...m,
      home_team: teamMap.get(m.home_team_uuid) ?? null,
      away_team: teamMap.get(m.away_team_uuid) ?? null,
    }));

    // Filter matches in JS by team name (simple + reliable)
    const matchesFiltered =
      matchesWithTeams.filter((m: any) => {
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
