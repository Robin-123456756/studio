import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession } from "@/lib/admin-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const supabase = getSupabase();

    const { data: matches, error } = await supabase
      .from("matches")
      .select("id, gameweek_id, home_goals, away_goals, is_played, home_team_uuid, away_team_uuid")
      .order("gameweek_id", { ascending: true })
      .order("id", { ascending: true });

    if (error) throw error;

    const { data: teams } = await supabase.from("teams").select("team_uuid, name, short_name");

    const teamMap: Record<string, { name: string; short_name: string }> = {};
    for (const t of teams || []) {
      teamMap[t.team_uuid] = { name: t.name, short_name: t.short_name };
    }

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
        home_team_uuid: m.home_team_uuid,
        away_team_uuid: m.away_team_uuid,
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

export async function PUT(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const supabase = getSupabase();
    const { matches } = await req.json();

    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json({ error: "matches array is required" }, { status: 400 });
    }

    let updated = 0;
    let cleanSheetsAwarded = 0;

    for (const match of matches) {
      const { id, home_goals, away_goals } = match;
      if (id === undefined || home_goals === undefined || away_goals === undefined) continue;

      // Update match score
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

      // Get match details for clean sheet logic
      const { data: matchData } = await supabase
        .from("matches")
        .select("home_team_uuid, away_team_uuid")
        .eq("id", id)
        .single();

      if (!matchData) continue;

      // Award clean sheets to teams that conceded 0 goals
      const cleanSheetTeams: string[] = [];
      if (parseInt(away_goals) === 0) cleanSheetTeams.push(matchData.home_team_uuid);
      if (parseInt(home_goals) === 0) cleanSheetTeams.push(matchData.away_team_uuid);

      for (const teamUuid of cleanSheetTeams) {
        // Get GK/DEF/MID players from this team who have an appearance in this match
        const { data: players } = await supabase
          .from("players")
          .select("id, position")
          .eq("team_id", teamUuid)
          .in("position", ["GK", "DEF", "MID"]);

        for (const player of players || []) {
          // Check if player has an appearance in this match
          const { data: appearance } = await supabase
            .from("player_match_events")
            .select("id")
            .eq("player_id", player.id)
            .eq("match_id", id)
            .eq("action", "appearance")
            .single();

          if (!appearance) continue;

          // Calculate clean sheet points based on position
          const csPoints = player.position === "GK" || player.position === "DEF" ? 4 : 1;

          // Upsert clean sheet
          const { error: csError } = await supabase
            .from("player_match_events")
            .upsert({
              player_id: player.id,
              match_id: id,
              action: "clean_sheet",
              quantity: 1,
              points_awarded: csPoints,
            }, {
              onConflict: "player_id,match_id,action",
            });

          if (!csError) cleanSheetsAwarded++;
        }
      }

      // Remove clean sheets for teams that DID concede
      const concededTeams: string[] = [];
      if (parseInt(away_goals) > 0) concededTeams.push(matchData.home_team_uuid);
      if (parseInt(home_goals) > 0) concededTeams.push(matchData.away_team_uuid);

      for (const teamUuid of concededTeams) {
        const { data: players } = await supabase
          .from("players")
          .select("id")
          .eq("team_id", teamUuid);

        const playerIds = (players || []).map((p) => p.id);
        if (playerIds.length > 0) {
          await supabase
            .from("player_match_events")
            .delete()
            .eq("match_id", id)
            .eq("action", "clean_sheet")
            .in("player_id", playerIds);
        }
      }
    }

    // Update player total_points
    const { error: ptError } = await supabase.rpc("recalculate_all_player_points");
    // Ignore if function doesn't exist yet

    return NextResponse.json({ success: true, updated, cleanSheetsAwarded });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}