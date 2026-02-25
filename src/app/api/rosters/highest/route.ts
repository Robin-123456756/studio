import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { computeUserScore } from "@/lib/scoring-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/rosters/highest?gw_id=3
 *
 * Finds the user with the highest GW points from their starting XI,
 * computed using the scoring engine (with auto-sub, vice-captain, bench boost).
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
      .select("user_id, player_id, is_starting_9, is_captain, is_vice_captain, multiplier, active_chip, bench_order")
      .eq("gameweek_id", gwId);

    if (rosterErr) {
      return NextResponse.json({ error: rosterErr.message }, { status: 500 });
    }

    if (firstTry && firstTry.length > 0) {
      allRosters = firstTry;
    } else {
      // No rosters for requested GW — find the nearest GW that has rosters
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
          .select("user_id, player_id, is_starting_9, is_captain, is_vice_captain, multiplier, active_chip, bench_order")
          .eq("gameweek_id", effectiveGwId);
        allRosters = fallbackRosters;
      }
    }

    if (!allRosters || allRosters.length === 0) {
      return NextResponse.json({ error: "No rosters found" }, { status: 404 });
    }

    gwId = effectiveGwId;

    // 2. Group rosters by user_id
    const byUser = new Map<string, any[]>();
    for (const row of allRosters) {
      const uid = String(row.user_id);
      if (!byUser.has(uid)) byUser.set(uid, []);
      byUser.get(uid)!.push({
        ...row,
        user_id: uid,
        player_id: String(row.player_id),
      });
    }

    // 3. Get player_stats for this GW (points + did_play)
    const allPlayerIds = [...new Set(allRosters.map((r) => String(r.player_id)))];
    const { data: statsData } = await supabase
      .from("player_stats")
      .select("player_id, points, did_play")
      .eq("gameweek_id", gwId)
      .in("player_id", allPlayerIds);

    const statsMap = new Map<string, { player_id: string; points: number; did_play: boolean }>();
    for (const s of statsData ?? []) {
      const pid = String(s.player_id);
      const existing = statsMap.get(pid);
      if (existing) {
        existing.points += s.points ?? 0;
        if (s.did_play) existing.did_play = true;
      } else {
        statsMap.set(pid, { player_id: pid, points: s.points ?? 0, did_play: s.did_play ?? false });
      }
    }

    // 4. Get player metadata (position, is_lady)
    const { data: playerMeta } = await supabase
      .from("players")
      .select("id, position, is_lady")
      .in("id", allPlayerIds);

    const metaMap = new Map<string, { id: string; position: string | null; is_lady: boolean | null }>();
    for (const p of playerMeta ?? []) {
      metaMap.set(String(p.id), { id: String(p.id), position: p.position, is_lady: p.is_lady });
    }

    // 5. Compute each user's score using the scoring engine
    let bestUserId: string | null = null;
    let bestTotal = -1;

    for (const [uid, rows] of byUser) {
      const result = computeUserScore(rows, statsMap, metaMap);
      if (result.totalPoints > bestTotal) {
        bestTotal = result.totalPoints;
        bestUserId = uid;
      }
    }

    if (!bestUserId) {
      return NextResponse.json({ error: "Could not determine highest scorer" }, { status: 404 });
    }

    // 6. Build roster response for the best user
    const bestRows = byUser.get(bestUserId)!;
    const multiplierByPlayer = Object.fromEntries(
      bestRows.map((r: any) => [String(r.player_id), Number(r.multiplier ?? 1)])
    );

    // 7. Try to get team name
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
      squadIds: bestRows.map((r: any) => r.player_id),
      startingIds: bestRows.filter((r: any) => r.is_starting_9).map((r: any) => r.player_id),
      captainId: bestRows.find((r: any) => r.is_captain)?.player_id ?? null,
      viceId: bestRows.find((r: any) => r.is_vice_captain)?.player_id ?? null,
      multiplierByPlayer,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
