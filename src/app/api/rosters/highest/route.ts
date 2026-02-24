import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rosters/highest?gw_id=3
 *
 * Finds the user with the highest GW points from their starting XI,
 * computed directly from user_rosters + player_stats.
 * Returns the same shape as /api/rosters/current plus the user's team name.
 */
export async function GET(req: Request) {
  try {
    const supabase = getSupabaseServerOrThrow();
    const url = new URL(req.url);

    const gwIdParam = url.searchParams.get("gw_id");
    let gwId = gwIdParam ? Number(gwIdParam) : NaN;

    if (!Number.isFinite(gwId)) {
      const { data: current } = await supabase
        .from("gameweeks")
        .select("id")
        .eq("is_current", true)
        .maybeSingle();
      gwId = current?.id ?? NaN;
    }

    if (!Number.isFinite(gwId)) {
      return NextResponse.json({ error: "No gameweek found" }, { status: 400 });
    }

    // 1. Get ALL user_rosters rows for this GW — fall back to latest GW with data
    let effectiveGwId = gwId;
    let allRosters: any[] | null = null;

    const { data: firstTry, error: rosterErr } = await supabase
      .from("user_rosters")
      .select("user_id, player_id, is_starting_9, is_captain, is_vice_captain, multiplier")
      .eq("gameweek_id", gwId);

    if (rosterErr) {
      return NextResponse.json({ error: rosterErr.message }, { status: 500 });
    }

    if (firstTry && firstTry.length > 0) {
      allRosters = firstTry;
    } else {
      // No rosters for requested GW — find the nearest GW that has rosters
      // Try earlier GWs first, then later GWs
      const { data: earlier } = await supabase
        .from("user_rosters")
        .select("gameweek_id")
        .lt("gameweek_id", gwId)
        .order("gameweek_id", { ascending: false })
        .limit(1);

      const { data: later } = await supabase
        .from("user_rosters")
        .select("gameweek_id")
        .gt("gameweek_id", gwId)
        .order("gameweek_id", { ascending: true })
        .limit(1);

      const earlierGw = earlier?.[0]?.gameweek_id;
      const laterGw = later?.[0]?.gameweek_id;

      // Pick whichever is closest to the requested GW
      let fallbackGw: number | undefined;
      if (earlierGw != null && laterGw != null) {
        fallbackGw = (gwId - earlierGw) <= (laterGw - gwId) ? earlierGw : laterGw;
      } else {
        fallbackGw = earlierGw ?? laterGw;
      }

      if (fallbackGw) {
        effectiveGwId = fallbackGw;
        const { data: fallbackRosters } = await supabase
          .from("user_rosters")
          .select("user_id, player_id, is_starting_9, is_captain, is_vice_captain, multiplier")
          .eq("gameweek_id", effectiveGwId);
        allRosters = fallbackRosters;
      }
    }

    if (!allRosters || allRosters.length === 0) {
      return NextResponse.json({ error: "No rosters found" }, { status: 404 });
    }

    // Update gwId to the effective one we're using
    gwId = effectiveGwId;

    // 2. Group rosters by user_id
    const byUser = new Map<string, typeof allRosters>();
    for (const row of allRosters) {
      const uid = String(row.user_id);
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push(row);
    }

    // 3. Get player_stats for this GW (points per player)
    const allPlayerIds = [...new Set(allRosters.map((r) => String(r.player_id)))];
    const { data: statsData } = await supabase
      .from("player_stats")
      .select("player_id, points")
      .eq("gameweek_id", gwId)
      .in("player_id", allPlayerIds);

    // Merge multiple stat rows per player (sum points)
    const pointsMap = new Map<string, number>();
    for (const s of statsData ?? []) {
      const pid = String(s.player_id);
      pointsMap.set(pid, (pointsMap.get(pid) ?? 0) + (s.points ?? 0));
    }

    // 4. Compute each user's total starting XI points
    let bestUserId: string | null = null;
    let bestTotal = -1;

    for (const [uid, rows] of byUser) {
      const startingRows = rows.filter((r) => r.is_starting_9);
      // If no starting XI marked, treat all as starting
      const effectiveStarting = startingRows.length > 0 ? startingRows : rows;
      const captainRow = rows.find((r) => r.is_captain);

      let total = 0;
      for (const r of effectiveStarting) {
        const pid = String(r.player_id);
        const pts = pointsMap.get(pid) ?? 0;
        const mult = Number(r.multiplier ?? (captainRow && String(captainRow.player_id) === pid ? 2 : 1));
        const m = Number.isFinite(mult) && mult > 0 ? mult : 1;
        total += pts * m;
      }

      if (total > bestTotal) {
        bestTotal = total;
        bestUserId = uid;
      }
    }

    if (!bestUserId) {
      return NextResponse.json({ error: "Could not determine highest scorer" }, { status: 404 });
    }

    // 5. Build roster response for the best user (same shape as /api/rosters/current)
    const bestRows = byUser.get(bestUserId)!;
    const multiplierByPlayer = Object.fromEntries(
      bestRows.map((r) => [String(r.player_id), Number(r.multiplier ?? 1)])
    );

    // 6. Try to get team name
    let teamName: string | null = null;
    const { data: teamRow } = await supabase
      .from("fantasy_teams")
      .select("team_name")
      .eq("user_id", bestUserId)
      .maybeSingle();
    teamName = (teamRow as any)?.team_name ?? null;

    return NextResponse.json({
      gwId,
      userId: bestUserId,
      teamName,
      totalPoints: bestTotal,
      squadIds: bestRows.map((r) => r.player_id),
      startingIds: bestRows.filter((r) => r.is_starting_9).map((r) => r.player_id),
      captainId: bestRows.find((r) => r.is_captain)?.player_id ?? null,
      viceId: bestRows.find((r) => r.is_vice_captain)?.player_id ?? null,
      multiplierByPlayer,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
