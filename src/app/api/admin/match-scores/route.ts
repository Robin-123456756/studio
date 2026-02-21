import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET — fetch all matches grouped by gameweek
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: matches, error } = await supabase
      .from("matches")
      .select(`
        id,
        gameweek_id,
        home_goals,
        away_goals,
        is_played,
        home_team_uuid,
        away_team_uuid
      `)
      .order("gameweek_id", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    // Fetch all teams for name lookup
    const { data: teams } = await supabase
      .from("teams")
      .select("team_uuid, name, short_name");

    const teamMap: Record<string, { name: string; short_name: string }> = {};
    for (const t of teams || []) {
      teamMap[t.team_uuid] = { name: t.name, short_name: t.short_name };
    }

    // Group by gameweek
    const gwMap: Record<number, any[]> = {};
    for (const m of matches || []) {
      const gw = m.gameweek_id;
      if (!gwMap[gw]) gwMap[gw] = [];
      const home = teamMap[m.home_team_uuid] || { name: "?", short_name: "?" };
      const away = teamMap[m.away_team_uuid] || { name: "?", short_name: "?" };
      gwMap[gw].push({
        id: m.id,
        gameweek_id: gw,
        home_goals: m.home_goals || 0,
        away_goals: m.away_goals || 0,
        is_played: m.is_played || false,
        home_team: home.name,
        home_short: home.short_name,
        away_team: away.name,
        away_short: away.short_name,
      });
    }

    const gameweeks = Object.entries(gwMap)
      .map(([id, matches]) => ({ id: parseInt(id), matches }))
      .sort((a, b) => a.id - b.id);

    return NextResponse.json({ gameweeks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — update match scores
export async function PUT(req: Request) {
  try {
    const supabase = getSupabase();
    const { matches } = await req.json();

    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json({ error: "matches array is required" }, { status: 400 });
    }

    let updated = 0;

    for (const match of matches) {
      const { id, home_goals, away_goals } = match;

      if (id === undefined || home_goals === undefined || away_goals === undefined) {
        continue;
      }

      const { error } = await supabase
        .from("matches")
        .update({
          home_goals: parseInt(home_goals),
          away_goals: parseInt(away_goals),
          is_played: true,
        })
        .eq("id", id);

      if (error) throw new Error(`Failed to update match ${id}: ${error.message}`);
      updated++;
    }

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}