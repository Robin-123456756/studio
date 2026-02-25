import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { computeUserScore } from "@/lib/scoring-engine";
import type { RosterRow, PlayerMeta, PlayerStat } from "@/lib/scoring-engine";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/fantasy-gw-details?gw_id=N
 *
 * Returns everything the points page needs in one call:
 *   - Roster (squad, starting, captain, vice)
 *   - Scoring engine output (auto-subs, captain activation, bench boost, total)
 *   - Per-player stats breakdown
 *   - Transfer cost
 *   - Active chip
 */
export async function GET(req: Request) {
  try {
    // ── Auth ──
    const supabase = await supabaseServer();
    const { data: auth, error: authErr } = await supabase.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = auth.user.id;
    const admin = getSupabaseServerOrThrow();

    const url = new URL(req.url);
    const gwId = Number(url.searchParams.get("gw_id") ?? "");
    if (!Number.isFinite(gwId) || gwId < 1) {
      return NextResponse.json({ error: "gw_id is required" }, { status: 400 });
    }

    // ── 1. Fetch roster rows (with rollover) ──
    const { data: rosterData, error: rosterErr } = await admin
      .from("user_rosters")
      .select("user_id, player_id, is_starting_9, is_captain, is_vice_captain, multiplier, active_chip, bench_order")
      .eq("user_id", userId)
      .eq("gameweek_id", gwId);

    if (rosterErr) {
      return NextResponse.json({ error: rosterErr.message }, { status: 500 });
    }

    let rows = rosterData ?? [];
    let effectiveGwId = gwId;

    // Rollover: if no roster for this GW, try previous
    if (rows.length === 0) {
      const { data: prev } = await admin
        .from("user_rosters")
        .select("gameweek_id")
        .eq("user_id", userId)
        .lt("gameweek_id", gwId)
        .order("gameweek_id", { ascending: false })
        .limit(1);

      if (prev && prev.length > 0) {
        const prevGwId = prev[0].gameweek_id;
        const { data: prevRows } = await admin
          .from("user_rosters")
          .select("user_id, player_id, is_starting_9, is_captain, is_vice_captain, multiplier, active_chip, bench_order")
          .eq("user_id", userId)
          .eq("gameweek_id", prevGwId);

        if (prevRows && prevRows.length > 0) {
          rows = prevRows;
          effectiveGwId = prevGwId;
        }
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({
        gwId,
        squadIds: [],
        originalStartingIds: [],
        effectiveStartingIds: [],
        captainId: null,
        viceId: null,
        totalPoints: 0,
        autoSubs: [],
        captainActivated: "none",
        benchBoost: false,
        activeChip: null,
        captainMultiplier: 2,
        transferCost: 0,
        players: [],
      });
    }

    // Build typed roster rows for scoring engine
    const rosterRows: RosterRow[] = rows.map((r: any) => ({
      user_id: userId,
      player_id: String(r.player_id),
      is_starting_9: r.is_starting_9,
      is_captain: r.is_captain,
      is_vice_captain: r.is_vice_captain,
      multiplier: r.multiplier ?? 1,
      active_chip: r.active_chip ?? null,
      bench_order: r.bench_order ?? null,
    }));

    const squadIds = rosterRows.map((r) => r.player_id);
    const originalStartingIds = rosterRows.filter((r) => r.is_starting_9).map((r) => r.player_id);
    const captainId = rosterRows.find((r) => r.is_captain)?.player_id ?? null;
    const viceId = rosterRows.find((r) => r.is_vice_captain)?.player_id ?? null;
    const activeChip = rosterRows.find((r) => r.active_chip)?.active_chip ?? null;

    // ── 2. Compute points from player_match_events (source of truth) ──
    const { data: gwMatches } = await admin
      .from("matches")
      .select("id")
      .eq("gameweek_id", effectiveGwId);
    const gwMatchIds = (gwMatches ?? []).map((m: any) => m.id);

    const pointsMap = new Map<string, number>();
    const playedFromEvents = new Set<string>();

    if (gwMatchIds.length > 0) {
      const { data: events } = await admin
        .from("player_match_events")
        .select("player_id, points_awarded, quantity")
        .in("match_id", gwMatchIds)
        .in("player_id", squadIds);

      for (const e of events ?? []) {
        const pid = String(e.player_id);
        const pts = (e.points_awarded ?? 0) * (e.quantity ?? 1);
        pointsMap.set(pid, (pointsMap.get(pid) ?? 0) + pts);
        playedFromEvents.add(pid);
      }
    }

    // Also check player_stats.did_play
    const { data: statsData } = await admin
      .from("player_stats")
      .select("player_id, did_play, points, goals, assists, clean_sheet, yellow_cards, red_cards, own_goals")
      .eq("gameweek_id", effectiveGwId)
      .in("player_id", squadIds);

    // Build unified stats map for scoring engine
    const statsMap = new Map<string, PlayerStat>();
    for (const pid of squadIds) {
      const didPlayFromStats = (statsData ?? []).some(
        (s: any) => String(s.player_id) === pid && s.did_play
      );
      statsMap.set(pid, {
        player_id: pid,
        points: pointsMap.get(pid) ?? 0,
        did_play: playedFromEvents.has(pid) || didPlayFromStats,
      });
    }

    // Build per-player stat breakdown from player_stats rows (for UI display)
    const statBreakdownMap = new Map<string, {
      goals: number; assists: number; cleanSheet: boolean;
      yellowCards: number; redCards: number; ownGoals: number;
    }>();
    for (const s of statsData ?? []) {
      const pid = String(s.player_id);
      const existing = statBreakdownMap.get(pid);
      if (existing) {
        existing.goals += s.goals ?? 0;
        existing.assists += s.assists ?? 0;
        existing.cleanSheet = existing.cleanSheet || (s.clean_sheet ?? false);
        existing.yellowCards += s.yellow_cards ?? 0;
        existing.redCards += s.red_cards ?? 0;
        existing.ownGoals += s.own_goals ?? 0;
      } else {
        statBreakdownMap.set(pid, {
          goals: s.goals ?? 0,
          assists: s.assists ?? 0,
          cleanSheet: s.clean_sheet ?? false,
          yellowCards: s.yellow_cards ?? 0,
          redCards: s.red_cards ?? 0,
          ownGoals: s.own_goals ?? 0,
        });
      }
    }

    // ── 3. Fetch player metadata ──
    const { data: playerData } = await admin
      .from("players")
      .select(
        "id, name, web_name, position, is_lady, teams:teams!players_team_id_fkey(name, short_name)"
      )
      .in("id", squadIds);

    const metaMap = new Map<string, PlayerMeta>();
    const playerInfoMap = new Map<string, {
      name: string; webName: string | null;
      position: string | null; teamShort: string | null;
      isLady: boolean;
    }>();

    for (const p of playerData ?? []) {
      const pid = String(p.id);
      metaMap.set(pid, {
        id: pid,
        position: p.position,
        is_lady: p.is_lady ?? false,
      });
      playerInfoMap.set(pid, {
        name: p.name ?? "--",
        webName: (p as any).web_name ?? null,
        position: p.position ?? null,
        teamShort: (p as any).teams?.short_name ?? null,
        isLady: p.is_lady ?? false,
      });
    }

    // ── 4. Run scoring engine ──
    const result = computeUserScore(rosterRows, statsMap, metaMap);

    // Derive effective starting IDs from scoring engine auto-subs
    const subbedOutIds = new Set(result.autoSubs.map((s) => s.outId));
    const subbedInIds = new Set(result.autoSubs.map((s) => s.inId));
    const effectiveStartingIds = originalStartingIds
      .filter((id) => !subbedOutIds.has(id))
      .concat([...subbedInIds]);

    // Captain multiplier
    const isTripleCaptain = activeChip === "triple_captain";
    const captainMultiplier = isTripleCaptain ? 3 : 2;

    // ── 5. Transfer cost ──
    let transferCost = 0;
    const { data: transferState } = await admin
      .from("user_transfer_state")
      .select("free_transfers, used_transfers, wildcard_active, free_hit_active")
      .eq("user_id", userId)
      .eq("gameweek_id", effectiveGwId)
      .maybeSingle();

    if (transferState) {
      const isWcOrFh = transferState.wildcard_active || transferState.free_hit_active;
      transferCost = isWcOrFh
        ? 0
        : Math.max(0, transferState.used_transfers - transferState.free_transfers) * 4;
    }

    // ── 6. Build player list ──
    const players = squadIds.map((pid) => {
      const info = playerInfoMap.get(pid);
      const gwPoints = pointsMap.get(pid) ?? 0;
      const breakdown = statBreakdownMap.get(pid) ?? null;
      return {
        id: pid,
        name: info?.name ?? "--",
        webName: info?.webName ?? null,
        position: info?.position ?? null,
        teamShort: info?.teamShort ?? null,
        isLady: info?.isLady ?? false,
        gwPoints,
        stat: breakdown
          ? {
              goals: breakdown.goals,
              assists: breakdown.assists,
              cleanSheet: breakdown.cleanSheet,
              yellowCards: breakdown.yellowCards,
              redCards: breakdown.redCards,
              ownGoals: breakdown.ownGoals,
            }
          : null,
      };
    });

    return NextResponse.json({
      gwId: effectiveGwId,
      squadIds,
      originalStartingIds,
      effectiveStartingIds,
      captainId,
      viceId,
      totalPoints: result.totalPoints,
      autoSubs: result.autoSubs,
      captainActivated: result.captainActivated,
      benchBoost: result.benchBoost,
      activeChip,
      captainMultiplier,
      transferCost,
      players,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed", stack: e?.stack ?? null },
      { status: 500 }
    );
  }
}
