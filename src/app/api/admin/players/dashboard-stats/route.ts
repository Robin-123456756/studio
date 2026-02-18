import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

export async function GET() {
  try {
    const supabase = getSupabase();

    const [playersRes, teamsRes, matchesRes, usersRes, eventsRes, gwRes] = await Promise.all([
      supabase.from("players").select("id", { count: "exact", head: true }),
      supabase.from("teams").select("id", { count: "exact", head: true }),
      supabase.from("matches").select("id", { count: "exact", head: true }).eq("is_played", true),
      supabase.from("fantasy_squads").select("user_id", { count: "exact", head: true }),
      supabase.from("player_match_events").select("id", { count: "exact", head: true }),
      supabase.from("matches").select("gameweek_id").order("gameweek_id", { ascending: false }).limit(1),
    ]);

    return NextResponse.json({
      players: playersRes.count || 0,
      teams: teamsRes.count || 0,
      matchesPlayed: matchesRes.count || 0,
      fantasyUsers: usersRes.count || 0,
      eventsLogged: eventsRes.count || 0,
      currentGameweek: gwRes.data?.[0]?.gameweek_id || 1,
    });
  } catch (error: any) {
    return NextResponse.json({
      players: "—",
      teams: "—",
      matchesPlayed: "—",
      fantasyUsers: "—",
      eventsLogged: "—",
      currentGameweek: "—",
    });
  }
}