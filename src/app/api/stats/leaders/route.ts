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

type StatPlayer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  position: string;
  isLady: boolean;
  teamName: string;
  teamShort: string;
  statValue: number;
};

/**
 * Aggregates season stats from `player_match_events` — the same source of
 * truth used by /api/player-stats, /api/fantasy-gw-details, and voice-admin.
 *
 * Points come from `players.total_points` which is maintained by the scoring
 * pipeline and already includes the lady 2x multiplier.
 */
export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();
    const url = new URL(req.url);
    const limit = Math.min(Number(url.searchParams.get("limit")) || 10, 30);

    // ── Fire all queries in parallel ──
    const [eventsRes, pointsRes] = await Promise.all([
      // All player_match_events for stat aggregation
      supabase
        .from("player_match_events")
        .select("player_id, action, quantity"),
      // Points: read from players.total_points (same as /api/players)
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
    ]);

    if (eventsRes.error) {
      return apiError(
        "Failed to fetch player events",
        "STAT_LEADERS_FAILED",
        500,
        eventsRes.error
      );
    }
    if (pointsRes.error) {
      return apiError(
        "Failed to fetch player points",
        "STAT_LEADERS_FAILED",
        500,
        pointsRes.error
      );
    }

    // ── Aggregate per player from player_match_events ──
    const totals = new Map<
      string,
      { goals: number; assists: number; cleanSheets: number; appearances: number }
    >();

    for (const e of eventsRes.data ?? []) {
      const pid = String(e.player_id);
      const qty = e.quantity ?? 1;
      const existing = totals.get(pid) ?? {
        goals: 0,
        assists: 0,
        cleanSheets: 0,
        appearances: 0,
      };

      switch (e.action) {
        case "goal":
          existing.goals += qty;
          break;
        case "assist":
          existing.assists += qty;
          break;
        case "clean_sheet":
          existing.cleanSheets += qty;
          break;
        case "appearance":
        case "sub_appearance":
          existing.appearances += qty;
          break;
      }

      totals.set(pid, existing);
    }

    // ── Fetch player details for top N of each stat ──
    const allPlayerIds = [...totals.keys()];
    const playerMap = new Map<string, any>();

    if (allPlayerIds.length > 0) {
      const { data: players } = await supabase
        .from("players")
        .select(
          `
          id, name, avatar_url, position, is_lady,
          teams:teams!players_team_id_fkey ( name, short_name )
        `
        )
        .in("id", allPlayerIds);

      for (const p of players ?? []) {
        playerMap.set(String(p.id), p);
      }
    }

    // ── Build sorted leader arrays ──
    function topN(
      extract: (v: { goals: number; assists: number; cleanSheets: number; appearances: number }) => number
    ): StatPlayer[] {
      return [...totals.entries()]
        .map(([pid, v]) => ({ pid, value: extract(v) }))
        .filter((r) => r.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, limit)
        .map((r) => mapPlayer(playerMap.get(r.pid), r.value));
    }

    const goals = topN((v) => v.goals);
    const assists = topN((v) => v.assists);
    const cleanSheets = topN((v) => v.cleanSheets);
    const appearances = topN((v) => v.appearances);

    // Points from players.total_points (already fetched)
    const points: StatPlayer[] = (pointsRes.data ?? []).map((p: any) => ({
      id: String(p.id),
      name: p.name ?? "--",
      avatarUrl: p.avatar_url ?? null,
      position: p.position ?? "--",
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

function mapPlayer(p: any, statValue: number): StatPlayer {
  return {
    id: String(p?.id ?? ""),
    name: p?.name ?? "--",
    avatarUrl: p?.avatar_url ?? null,
    position: p?.position ?? "--",
    isLady: p?.is_lady ?? false,
    teamName: p?.teams?.name ?? "--",
    teamShort: p?.teams?.short_name ?? "--",
    statValue,
  };
}
