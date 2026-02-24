import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { rateLimitResponse, RATE_LIMIT_STANDARD } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/admin/bonus-points?match_id=N — top performers for a match */
export async function GET(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();
  const { searchParams } = new URL(req.url);
  const matchId = searchParams.get("match_id");

  if (!matchId) {
    return NextResponse.json({ error: "match_id required" }, { status: 400 });
  }

  try {
    // Get all match events for this match, grouped by player
    const { data: events, error } = await supabase
      .from("player_match_events")
      .select("player_id, action, points_awarded")
      .eq("match_id", matchId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Aggregate points per player (excluding existing bonus)
    const playerPoints = new Map<string, { total: number; bonus: number }>();
    for (const e of events ?? []) {
      const pid = e.player_id;
      const existing = playerPoints.get(pid) || { total: 0, bonus: 0 };
      if (e.action === "bonus") {
        existing.bonus = e.points_awarded || 0;
      } else {
        existing.total += e.points_awarded || 0;
      }
      playerPoints.set(pid, existing);
    }

    // Get player names
    const playerIds = Array.from(playerPoints.keys());
    let playerMap = new Map<string, any>();
    if (playerIds.length > 0) {
      const { data: players } = await supabase
        .from("players")
        .select("id, name, web_name, position, team_id")
        .in("id", playerIds);

      for (const p of players ?? []) {
        playerMap.set(p.id, p);
      }
    }

    // Build sorted list
    const performers = Array.from(playerPoints.entries())
      .map(([pid, stats]) => {
        const p = playerMap.get(pid);
        return {
          playerId: pid,
          playerName: p?.web_name || p?.name || "Unknown",
          position: p?.position || "?",
          teamId: p?.team_id,
          matchPoints: stats.total,
          currentBonus: stats.bonus,
        };
      })
      .sort((a, b) => b.matchPoints - a.matchPoints);

    return NextResponse.json({ performers });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed" }, { status: 500 });
  }
}

/** POST /api/admin/bonus-points — assign bonus points */
export async function POST(req: Request) {
  const { session, error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const userId = (session!.user as any).userId || session!.user?.name || "unknown";
  const rlResponse = rateLimitResponse("bonus-points", userId, RATE_LIMIT_STANDARD);
  if (rlResponse) return rlResponse;

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { match_id, bonuses } = body;
    // bonuses: [{ player_id, points }]  where points is 1, 2, or 3

    if (!match_id || !Array.isArray(bonuses)) {
      return NextResponse.json({ error: "match_id and bonuses array required" }, { status: 400 });
    }

    // Remove old bonus entries for this match
    await supabase
      .from("player_match_events")
      .delete()
      .eq("match_id", match_id)
      .eq("action", "bonus");

    // Insert new bonus entries
    if (bonuses.length > 0) {
      const rows = bonuses.map((b: any) => ({
        match_id,
        player_id: b.player_id,
        action: "bonus",
        points_awarded: Number(b.points),
      }));

      const { error } = await supabase
        .from("player_match_events")
        .insert(rows);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Recalculate player total points
    try {
      await supabase.rpc("recalculate_all_player_points");
    } catch {
      // RPC may not exist — non-fatal
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save bonus" }, { status: 500 });
  }
}
