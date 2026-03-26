import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}


export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 30);

    // Fire all stat aggregations in parallel
    const [goalsRes, assistsRes, cleanSheetsRes, pointsRes, appearancesRes] =
      await Promise.all([
        // Top goal scorers
        supabase.rpc("get_stat_leaders", {
          stat_action: "goal",
          result_limit: limit,
        }),
        // Top assisters
        supabase.rpc("get_stat_leaders", {
          stat_action: "assist",
          result_limit: limit,
        }),
        // Top clean sheets
        supabase.rpc("get_stat_leaders", {
          stat_action: "clean_sheet",
          result_limit: limit,
        }),
        // Top points — use players.total_points directly
        supabase
          .from("players")
          .select(
            `
            id, name, avatar_url, position, is_lady, total_points,
            teams:teams!players_team_id_fkey ( name, short_name )
          `
          )
          .gt("total_points", 0)
          .order("total_points", { ascending: false })
          .limit(limit),
        // Top appearances
        supabase.rpc("get_stat_leaders", {
          stat_action: "appearance",
          result_limit: limit,
        }),
      ]);

    // If the RPC doesn't exist yet, fall back to raw queries
    const useRpc = !goalsRes.error;

    let goals, assists, cleanSheets, appearances;

    if (useRpc) {
      goals = (goalsRes.data ?? []).map(mapRpcRow);
      assists = (assistsRes.data ?? []).map(mapRpcRow);
      cleanSheets = (cleanSheetsRes.data ?? []).map(mapRpcRow);
      appearances = (appearancesRes.data ?? []).map(mapRpcRow);
    } else {
      // Fallback: aggregate from player_match_events directly
      const [gRes, aRes, csRes, appRes] = await Promise.all([
        aggregateStat(supabase, "goal", limit),
        aggregateStat(supabase, "assist", limit),
        aggregateStat(supabase, "clean_sheet", limit),
        aggregateStat(supabase, "appearance", limit),
      ]);
      goals = gRes;
      assists = aRes;
      cleanSheets = csRes;
      appearances = appRes;
    }

    // Points from players table (already fetched)
    const points = (pointsRes.data ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      avatarUrl: p.avatar_url,
      position: p.position,
      isLady: p.is_lady ?? false,
      teamName: p.teams?.name ?? "--",
      teamShort: p.teams?.short_name ?? "--",
      statValue: p.total_points ?? 0,
    }));

    return NextResponse.json(
      { goals, assists, cleanSheets, points, appearances },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (e: unknown) {
    return apiError("Failed to fetch stat leaders", "STAT_LEADERS_FAILED", 500, e);
  }
}

function mapRpcRow(row: any) {
  return {
    id: row.player_id ?? row.id,
    name: row.player_name ?? row.name,
    avatarUrl: row.avatar_url,
    position: row.position,
    isLady: row.is_lady ?? false,
    teamName: row.team_name ?? "--",
    teamShort: row.team_short ?? "--",
    statValue: Number(row.stat_value ?? row.total ?? 0),
  };
}

async function aggregateStat(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  action: string,
  limit: number
) {
  // Get aggregated events
  const { data: events } = await supabase
    .from("player_match_events")
    .select("player_id, quantity")
    .eq("action", action);

  if (!events || events.length === 0) return [];

  // Sum quantities per player
  const totals = new Map<string, number>();
  for (const e of events as any[]) {
    const pid = String(e.player_id);
    totals.set(pid, (totals.get(pid) ?? 0) + (e.quantity ?? 1));
  }

  // Sort and take top N
  const sorted = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (sorted.length === 0) return [];

  // Fetch player details for top N
  const playerIds = sorted.map(([id]) => id);
  const { data: players } = await supabase
    .from("players")
    .select(
      `
      id, name, avatar_url, position, is_lady,
      teams:teams!players_team_id_fkey ( name, short_name )
    `
    )
    .in("id", playerIds);

  const playerMap = new Map<string, any>();
  for (const p of (players ?? []) as any[]) {
    playerMap.set(String(p.id), p);
  }

  return sorted.map(([pid, val]) => {
    const p = playerMap.get(pid);
    return {
      id: pid,
      name: p?.name ?? "--",
      avatarUrl: p?.avatar_url ?? null,
      position: p?.position ?? "--",
      isLady: p?.is_lady ?? false,
      teamName: p?.teams?.name ?? "--",
      teamShort: p?.teams?.short_name ?? "--",
      statValue: val,
    };
  });
}
