import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * GET /api/admin/match-scorers?matchIds=1,2,3
 * Returns goal scorers per match with penalty counts.
 */
export async function GET(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const supabase = getSupabase();
    const url = new URL(req.url);
    const matchIdsRaw = url.searchParams.get("matchIds") || "";
    const matchIds = matchIdsRaw.split(",").map(Number).filter(Number.isFinite);

    if (matchIds.length === 0) {
      return NextResponse.json({ error: "matchIds required" }, { status: 400 });
    }

    // Fetch goal events
    const { data: events, error } = await supabase
      .from("player_match_events")
      .select("match_id, player_id, quantity, penalties")
      .eq("action", "goal")
      .in("match_id", matchIds);

    if (error) throw new Error(error.message);

    if (!events || events.length === 0) {
      return NextResponse.json({ scorers: {} });
    }

    // Fetch player names + team_id
    const playerIds = [...new Set(events.map((e) => e.player_id))];
    const { data: players } = await supabase
      .from("players")
      .select("id, name, web_name, team_id")
      .in("id", playerIds);

    const playerMap = new Map<string, { name: string; teamId: string }>();
    for (const p of players ?? []) {
      playerMap.set(p.id, { name: p.web_name || p.name, teamId: p.team_id });
    }

    // Fetch match team UUIDs to determine home/away
    const { data: matches } = await supabase
      .from("matches")
      .select("id, home_team_uuid, away_team_uuid")
      .in("id", matchIds);

    const matchTeamMap = new Map<number, { home: string; away: string }>();
    for (const m of matches ?? []) {
      matchTeamMap.set(m.id, { home: m.home_team_uuid, away: m.away_team_uuid });
    }

    // Build scorers grouped by match
    const scorers: Record<number, { playerId: string; playerName: string; goals: number; penalties: number; team: "home" | "away" }[]> = {};
    for (const e of events) {
      if (!scorers[e.match_id]) scorers[e.match_id] = [];
      const player = playerMap.get(e.player_id);
      const matchTeams = matchTeamMap.get(e.match_id);
      const side = player && matchTeams
        ? player.teamId === matchTeams.home ? "home" : "away"
        : "home";
      scorers[e.match_id].push({
        playerId: e.player_id,
        playerName: player?.name ?? "Unknown",
        goals: e.quantity ?? 1,
        penalties: e.penalties ?? 0,
        team: side,
      });
    }

    return NextResponse.json({ scorers });
  } catch (error: unknown) {
    return apiError("Failed to fetch match scorers", "MATCH_SCORERS_FETCH_FAILED", 500, error);
  }
}

/**
 * PUT /api/admin/match-scorers
 * Update penalties count for a goal event.
 * Body: { matchId, playerId, penalties }
 */
export async function PUT(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const supabase = getSupabase();
    const { matchId, playerId, penalties } = await req.json();

    if (!matchId || !playerId || penalties === undefined) {
      return NextResponse.json({ error: "matchId, playerId, penalties required" }, { status: 400 });
    }

    // Update penalties on the goal event
    const { error } = await supabase
      .from("player_match_events")
      .update({ penalties: Math.max(0, penalties) })
      .eq("match_id", matchId)
      .eq("player_id", playerId)
      .eq("action", "goal");

    if (error) throw new Error(error.message);

    // Also update player_stats.penalties (denormalized)
    const { data: matchRow } = await supabase
      .from("matches")
      .select("gameweek_id")
      .eq("id", matchId)
      .single();

    if (matchRow?.gameweek_id) {
      await supabase
        .from("player_stats")
        .update({ penalties: Math.max(0, penalties) })
        .eq("player_id", playerId)
        .eq("gameweek_id", matchRow.gameweek_id);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return apiError("Failed to update penalties", "PENALTIES_UPDATE_FAILED", 500, error);
  }
}
