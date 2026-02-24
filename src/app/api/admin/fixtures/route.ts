import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession } from "@/lib/admin-auth";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET — fetch teams or upcoming events
export async function GET(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");

    if (type === "teams") {
      const { data, error } = await supabase
        .from("teams")
        .select("team_uuid, name, short_name")
        .order("name");
      if (error) throw error;
      return NextResponse.json({ teams: data });
    }

    // Fetch upcoming matches (not played)
    const { data: matches, error: mError } = await supabase
      .from("matches")
      .select("id, gameweek_id, home_team_uuid, away_team_uuid, kickoff_time, is_played")
      .eq("is_played", false)
      .order("kickoff_time", { ascending: true });

    if (mError) throw mError;

    // Fetch league events
    const { data: leagueEvents, error: eError } = await supabase
      .from("league_events")
      .select("*")
      .order("event_time", { ascending: true });

    // Build team map
    const { data: teams } = await supabase.from("teams").select("team_uuid, name, short_name");
    const teamMap: Record<string, string> = {};
    for (const t of teams || []) {
      teamMap[t.team_uuid] = t.short_name;
    }

    const events: any[] = [];

    // Add matches
    for (const m of matches || []) {
      events.push({
        id: m.id,
        type: "match",
        title: `${teamMap[m.home_team_uuid] || "?"} vs ${teamMap[m.away_team_uuid] || "?"}`,
        description: null,
        gameweek_id: m.gameweek_id,
        home_team_uuid: m.home_team_uuid,
        away_team_uuid: m.away_team_uuid,
        home_team: teamMap[m.home_team_uuid] || "?",
        away_team: teamMap[m.away_team_uuid] || "?",
        venue: null,
        kickoff_time: m.kickoff_time,
        is_played: m.is_played,
      });
    }

    // Add league events (if table exists)
    if (!eError && leagueEvents) {
      for (const e of leagueEvents) {
        events.push({
          id: e.id,
          type: e.event_type || "tournament",
          title: e.title,
          description: e.description,
          gameweek_id: null,
          home_team_uuid: e.home_team_uuid,
          away_team_uuid: e.away_team_uuid,
          home_team: e.home_team_uuid ? teamMap[e.home_team_uuid] : null,
          away_team: e.away_team_uuid ? teamMap[e.away_team_uuid] : null,
          venue: e.venue,
          kickoff_time: e.event_time,
          is_played: false,
        });
      }
    }

    // Sort by time
    events.sort((a, b) => {
      if (!a.kickoff_time) return 1;
      if (!b.kickoff_time) return -1;
      return new Date(a.kickoff_time).getTime() - new Date(b.kickoff_time).getTime();
    });

    return NextResponse.json({ events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST — schedule match or create event
export async function POST(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const supabase = getSupabase();
    const body = await req.json();
    const { action } = body;

    if (action === "schedule_match") {
      const { gameweek_id, home_team_uuid, away_team_uuid, kickoff_time, venue } = body;

      if (!home_team_uuid || !away_team_uuid || !gameweek_id) {
        return NextResponse.json({ error: "home_team, away_team, and gameweek are required" }, { status: 400 });
      }

      const insertData: any = {
        gameweek_id,
        home_team_uuid,
        away_team_uuid,
        home_goals: 0,
        away_goals: 0,
        is_played: false,
        is_final: false,
      };

      if (kickoff_time) insertData.kickoff_time = new Date(kickoff_time).toISOString();

      const { data, error } = await supabase
        .from("matches")
        .insert(insertData)
        .select()
        .single();

      if (error) throw new Error(`Failed to schedule match: ${error.message}`);
      return NextResponse.json({ success: true, match: data });
    }

    if (action === "create_event") {
      const { type, title, description, kickoff_time, venue, home_team_uuid, away_team_uuid } = body;

      if (!title) {
        return NextResponse.json({ error: "Event title is required" }, { status: 400 });
      }

      const insertData: any = {
        event_type: type || "tournament",
        title,
        description: description || null,
        venue: venue || null,
        home_team_uuid: home_team_uuid || null,
        away_team_uuid: away_team_uuid || null,
      };

      if (kickoff_time) insertData.event_time = new Date(kickoff_time).toISOString();

      const { data, error } = await supabase
        .from("league_events")
        .insert(insertData)
        .select()
        .single();

      if (error) throw new Error(`Failed to create event: ${error.message}`);
      return NextResponse.json({ success: true, event: data });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE — remove an event
export async function DELETE(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const supabase = getSupabase();
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Event id is required" }, { status: 400 });
    }

    // Try deleting from league_events first
    const { error: eError } = await supabase
      .from("league_events")
      .delete()
      .eq("id", id);

    if (eError) {
      // If not in league_events, might be a match — don't delete matches from here
      return NextResponse.json({ error: "Cannot delete league matches from here. Use Supabase dashboard." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}