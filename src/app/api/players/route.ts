import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

export async function GET(req: Request) {
  try {
    const supabase = getSupabaseAdmin();

    const url = new URL(req.url);
    const teamId = url.searchParams.get("team_id");
    const idsParam = url.searchParams.get("ids");
    let query = supabase
      .from("players")
      .select(
        `
        id,
        name,
        web_name,
        position,
        now_cost,
        total_points,
        avatar_url,
        is_lady,
        team_id,
        teams:teams!players_team_id_fkey (
          name,
          short_name,
          team_uuid
        )
      `
      )
      .order("name", { ascending: true });

    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length > 0) query = query.in("id", ids);
    }

    if (teamId) query = query.eq("team_id", teamId);

    // ── Phase 1: Fire independent queries in parallel ──
    const [
      playersResult,
      managerCountResult,
      upcomingMatchesResult,
      completedGwResult,
    ] = await Promise.all([
      query,
      supabase.from("fantasy_teams").select("user_id", { count: "exact", head: true }),
      supabase
        .from("matches")
        .select(`
          home_team_uuid, away_team_uuid,
          home_team:teams!matches_home_team_uuid_fkey (short_name),
          away_team:teams!matches_away_team_uuid_fkey (short_name)
        `)
        .eq("is_played", false)
        .order("gameweek_id", { ascending: true }),
      // Last 5 completed gameweeks for FPL-style form (fixed-window PPG)
      supabase
        .from("gameweeks")
        .select("id")
        .eq("finalized", true)
        .order("id", { ascending: false })
        .limit(5),
    ]);

    const { data, error } = playersResult;
    if (error) {
      return apiError("Failed to fetch players", "PLAYERS_FETCH_FAILED", 500, error);
    }

    const playerIds = (data ?? []).map((p: any) => String(p.id));
    const registeredManagers = typeof managerCountResult.count === "number" ? managerCountResult.count : 0;

    // Build next-opponent map from already-fetched matches
    const nextOpponentMap = new Map<string, string>();
    const upcomingMatches = upcomingMatchesResult.data;
    if (upcomingMatches && upcomingMatches.length > 0) {
      for (const m of upcomingMatches) {
        const homeUuid = (m as any).home_team_uuid;
        const awayUuid = (m as any).away_team_uuid;
        const homeShort = (m as any).home_team?.short_name;
        const awayShort = (m as any).away_team?.short_name;
        if (homeUuid && awayShort && !nextOpponentMap.has(homeUuid)) {
          nextOpponentMap.set(homeUuid, awayShort);
        }
        if (awayUuid && homeShort && !nextOpponentMap.has(awayUuid)) {
          nextOpponentMap.set(awayUuid, homeShort);
        }
      }
    }

    // ── Phase 2: Fire player-dependent queries in parallel ──
    const ownershipMap = new Map<string, number>();
    const totalsMap = new Map<
      string,
      { points: number; goals: number; assists: number; appearances: number }
    >();
    const formMap = new Map<string, string>();
    const priceChangeMap = new Map<string, number>();

    if (playerIds.length > 0) {
      // Fire ownership, stats, and price queries in parallel
      // player_stats uses fetchAllRows() to avoid Supabase's 1000-row silent truncation
      const ownershipPromise = supabase
        .from("current_squads")
        .select("player_id, user_id")
        .in("player_id", playerIds);

      const statsPromise = fetchAllRows((from, to) =>
        supabase
          .from("player_stats")
          .select("player_id, points, goals, assists, gameweek_id")
          .in("player_id", playerIds)
          .range(from, to)
      );

      const pricePromise = supabase
        .from("player_price_history")
        .select("player_id, old_price, new_price")
        .in("player_id", playerIds)
        .order("changed_at", { ascending: false });

      const [ownershipResult, allStats, priceResult] = await Promise.all([
        ownershipPromise,
        statsPromise,
        pricePromise,
      ]);

      // ── Ownership calculation (from current_squads — always up-to-date) ──
      const ownersByPlayer = new Map<string, Set<string>>();
      const allOwnerIds = new Set<string>();
      for (const row of ownershipResult.data ?? []) {
        const pid = String((row as any).player_id);
        const uid = String((row as any).user_id);
        if (!ownersByPlayer.has(pid)) ownersByPlayer.set(pid, new Set<string>());
        ownersByPlayer.get(pid)!.add(uid);
        allOwnerIds.add(uid);
      }
      // Use the larger of fantasy_teams count or distinct current_squads users
      // so ownership can never exceed 100% (guards against count query failures)
      const denominator = Math.max(registeredManagers, allOwnerIds.size, 1);
      for (const pid of playerIds) {
        const selectedCount = ownersByPlayer.get(pid)?.size ?? 0;
        const ownershipPct =
          denominator > 0 ? Math.round((selectedCount / denominator) * 1000) / 10 : 0;
        ownershipMap.set(pid, ownershipPct);
      }

      // ── Points & form from player_stats ──
      // Form uses FPL-style fixed window: total points in last 5 completed GWs / 5.
      // This rewards players who play consistently — missing a GW counts as 0.
      if (completedGwResult.error) {
        console.error("[api/players] completedGwResult error", completedGwResult.error);
      }
      const formGwIds = new Set<number>(
        (completedGwResult.data ?? []).map((g: any) => g.id)
      );
      // Always divide by the fixed window of 5 (FPL-style) so missing a GW counts as 0.
      // Only fall back to 1 if no GWs exist yet (very start of season / test environment).
      const FORM_WINDOW = 5;
      const formWindow = formGwIds.size === 0 ? 1 : FORM_WINDOW;

      if (allStats.length > 0) {
        const formPointsMap = new Map<string, number>();
        for (const s of allStats) {
          const pid = String((s as any).player_id);
          const gwId = (s as any).gameweek_id;
          const pts = (s as any).points ?? 0;
          const goals = (s as any).goals ?? 0;
          const assists = (s as any).assists ?? 0;

          // Season totals (all GWs)
          const existing = totalsMap.get(pid) ?? {
            points: 0,
            goals: 0,
            assists: 0,
            appearances: 0,
          };
          existing.points += pts;
          existing.goals += goals;
          existing.assists += assists;
          existing.appearances += 1;
          totalsMap.set(pid, existing);

          // Form: only accumulate points from the last 5 completed GWs
          if (formGwIds.has(gwId)) {
            formPointsMap.set(pid, (formPointsMap.get(pid) ?? 0) + pts);
          }
        }
        // Divide by fixed window (not games played) so missing GWs count as 0
        for (const pid of playerIds) {
          const recentPts = formPointsMap.get(pid) ?? 0;
          formMap.set(pid, (recentPts / formWindow).toFixed(1));
        }
      }

      // ── Price changes ──
      const priceHistory = priceResult.data;
      if (priceHistory && priceHistory.length > 0) {
        for (const row of priceHistory) {
          const pid = String((row as any).player_id);
          if (!priceChangeMap.has(pid)) {
            priceChangeMap.set(pid, ((row as any).new_price ?? 0) - ((row as any).old_price ?? 0));
          }
        }
      }
    }

    // ── Build response ──
    const players = (data ?? []).map((p: any) => {
      const pid = String(p.id);
      const totals = totalsMap.get(pid) ?? null;
      const isLady = p.is_lady ?? false;
      const ladyMultiplier = isLady ? 2 : 1;
      // total_points is maintained by increment_player_points / recalculate_all_player_points
      // and already includes the lady 2x multiplier applied per action — do NOT multiply again.
      // player_stats.points is never written by the scoring pipeline so it is always 0.
      const rawPoints = p.total_points ?? 0;
      return {
        id: p.id,
        name: p.name ?? p.web_name ?? "--",
        webName: p.web_name ?? null,
        position: p.position,
        price: p.now_cost ?? null,
        priceChange: priceChangeMap.get(pid) ?? 0,
        points: rawPoints,
        rawPoints,
        pointsMultiplier: ladyMultiplier,
        avatarUrl: p.avatar_url ?? null,
        isLady,
        teamId: p.team_id,
        teamName: p.teams?.name ?? "--",
        teamShort: p.teams?.short_name ?? "--",
        teamUuid: p.teams?.team_uuid ?? null,
        ownership: ownershipMap.get(pid) ?? 0,
        form_last5: formMap.get(pid) ?? null,
        next_opponent: nextOpponentMap.get(p.teams?.team_uuid) ?? null,
        ...(totals
          ? {
              totalGoals: totals.goals,
              totalAssists: totals.assists,
              appearances: totals.appearances,
            }
          : {}),
      };
    });

    return NextResponse.json(
      { players },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e: unknown) {
    return apiError("Failed to fetch players", "PLAYERS_FETCH_FAILED", 500, e);
  }
}

export async function POST(req: Request) {
  try {
    const { error: authErr } = await requireAdminSession();
    if (authErr) return authErr;

    const supabase = getSupabaseAdmin();
    const body = await req.json();

    const { name, web_name, position, now_cost, team_id, is_lady } = body;

    if (!name || !position || !team_id) {
      return NextResponse.json(
        { error: "name, position, and team_id are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("players")
      .insert({
        name,
        web_name: web_name || name.split(" ").pop(),
        position,
        now_cost: now_cost || 5.0,
        team_id,
        is_lady: is_lady || false,
        total_points: 0,
      })
      .select()
      .single();

    if (error) {
      return apiError("Failed to add player", "PLAYER_INSERT_FAILED", 500, error);
    }

    return NextResponse.json(data);
  } catch (error: unknown) {
    return apiError("Failed to add player", "PLAYER_INSERT_FAILED", 500, error);
  }
}
