import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { computeUserScore, norm, lookupPoints, loadScoringRules } from "@/lib/scoring-engine";
import type { RosterRow, PlayerMeta, PlayerStat } from "@/lib/scoring-engine";
import { apiError } from "@/lib/api-error";
import {
  computeTransferCost,
  computeLeagueStats,
  stripChipsForRollover,
} from "@/lib/gw-details-utils";

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
    const currentUserId = auth.user.id;
    const admin = getSupabaseServerOrThrow();

    const url = new URL(req.url);
    const gwId = Number(url.searchParams.get("gw_id") ?? "");

    // Optional: view another manager's team (read-only)
    const targetUserId = url.searchParams.get("user_id") || currentUserId;
    const isManagerView = targetUserId !== currentUserId;
    const userId = targetUserId;
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
      return apiError("Failed to load roster", "GW_DETAILS_ROSTER_FAILED", 500, rosterErr);
    }

    let rows = rosterData ?? [];
    let rosterSourceGwId = gwId;
    let isBackfilled = false;

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
          rows = stripChipsForRollover(prevRows);
          rosterSourceGwId = prevGwId;
        }
      }
    }

    // Forward rollover: if still no roster (pre-signup GWs), use the user's
    // FIRST ever roster so they can see what their squad earned in past GWs.
    // Stats are still looked up for the requested GW (not the roster's GW).
    if (rows.length === 0) {
      const { data: first } = await admin
        .from("user_rosters")
        .select("gameweek_id")
        .eq("user_id", userId)
        .gt("gameweek_id", gwId)
        .order("gameweek_id", { ascending: true })
        .limit(1);

      if (first && first.length > 0) {
        const firstGwId = first[0].gameweek_id;
        const { data: firstRows } = await admin
          .from("user_rosters")
          .select("user_id, player_id, is_starting_9, is_captain, is_vice_captain, multiplier, active_chip, bench_order")
          .eq("user_id", userId)
          .eq("gameweek_id", firstGwId);

        if (firstRows && firstRows.length > 0) {
          rows = stripChipsForRollover(firstRows);
          rosterSourceGwId = firstGwId;
          isBackfilled = true;
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
        isBackfilled: false,
      });
    }

    // Always look up stats for the REQUESTED GW — like FPL, we want to
    // see how the roster (even if rolled over from a previous GW) performed
    // in the GW the user is viewing.
    const statsGwId = gwId;

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

    // ── 2. Compute points from player_match_events using scoring rules ──
    //    (recalculates from action + rules, matching the scoring engine —
    //     never relies on pre-stored points_awarded which can be stale/0)
    const { data: gwMatches } = await admin
      .from("matches")
      .select("id")
      .eq("gameweek_id", statsGwId);
    const gwMatchIds = (gwMatches ?? []).map((m: any) => m.id);

    // We need player metadata early for rules-based recalculation (position, is_lady)
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

    // Load scoring rules (same as scoring engine)
    const rules = await loadScoringRules();

    const pointsMap = new Map<string, number>();
    const playedFromEvents = new Set<string>();
    const hasAppearanceEvent = new Set<string>();

    const bonusMap = new Map<string, number>(); // playerId → bonus points (3/2/1)

    if (gwMatchIds.length > 0) {
      const { data: events } = await admin
        .from("player_match_events")
        .select("player_id, action, quantity, points_awarded")
        .in("match_id", gwMatchIds)
        .in("player_id", squadIds);

      for (const e of events ?? []) {
        const pid = String(e.player_id);
        const meta = metaMap.get(pid);
        const position = norm(meta?.position);
        const isLady = meta?.is_lady ?? false;

        // Bonus uses stored points_awarded directly (not from scoring_rules)
        let pts: number;
        if (e.action === "bonus") {
          pts = (e.points_awarded ?? 0) * (e.quantity ?? 1);
          bonusMap.set(pid, (bonusMap.get(pid) ?? 0) + pts);
        } else {
          pts = lookupPoints(rules, e.action, position, isLady) * (e.quantity ?? 1);
        }
        pointsMap.set(pid, (pointsMap.get(pid) ?? 0) + pts);
        playedFromEvents.add(pid);
        if (e.action === "appearance" || e.action === "sub_appearance") hasAppearanceEvent.add(pid);
      }
    }

    // Also check player_stats.did_play
    const { data: statsData } = await admin
      .from("player_stats")
      .select("player_id, did_play, points, goals, penalties, assists, clean_sheet, yellow_cards, red_cards, own_goals")
      .eq("gameweek_id", statsGwId)
      .in("player_id", squadIds);

    const playedFromStats = new Set<string>();
    for (const s of statsData ?? []) {
      if (s.did_play) playedFromStats.add(String(s.player_id));
    }

    // Add appearance points for players who played but don't have an
    // appearance event (mirrors scoring engine step 3f)
    for (const pid of squadIds) {
      if (hasAppearanceEvent.has(pid)) continue;
      const played = playedFromEvents.has(pid) || playedFromStats.has(pid);
      if (played) {
        const meta = metaMap.get(pid);
        const position = norm(meta?.position);
        const isLady = meta?.is_lady ?? false;
        const appearancePts = lookupPoints(rules, "appearance", position, isLady);
        pointsMap.set(pid, (pointsMap.get(pid) ?? 0) + appearancePts);
      }
    }

    // Build unified stats map for scoring engine
    const statsMap = new Map<string, PlayerStat>();
    for (const pid of squadIds) {
      statsMap.set(pid, {
        player_id: pid,
        points: pointsMap.get(pid) ?? 0,
        did_play: playedFromEvents.has(pid) || playedFromStats.has(pid),
      });
    }

    // Build per-player stat breakdown from player_stats rows (for UI display)
    const statBreakdownMap = new Map<string, {
      goals: number; penalties: number; assists: number; cleanSheet: boolean;
      yellowCards: number; redCards: number; ownGoals: number;
    }>();
    for (const s of statsData ?? []) {
      const pid = String(s.player_id);
      const existing = statBreakdownMap.get(pid);
      if (existing) {
        existing.goals += s.goals ?? 0;
        existing.penalties += s.penalties ?? 0;
        existing.assists += s.assists ?? 0;
        existing.cleanSheet = existing.cleanSheet || (s.clean_sheet ?? false);
        existing.yellowCards += s.yellow_cards ?? 0;
        existing.redCards += s.red_cards ?? 0;
        existing.ownGoals += s.own_goals ?? 0;
      } else {
        statBreakdownMap.set(pid, {
          goals: s.goals ?? 0,
          penalties: s.penalties ?? 0,
          assists: s.assists ?? 0,
          cleanSheet: s.clean_sheet ?? false,
          yellowCards: s.yellow_cards ?? 0,
          redCards: s.red_cards ?? 0,
          ownGoals: s.own_goals ?? 0,
        });
      }
    }

    // ── 3. Run scoring engine ──
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

    // ── 5. Transfer cost + counts (skip for backfilled pre-signup GWs and manager views) ──
    let transferCost = 0;
    let freeTransfers = 0;
    let usedTransfers = 0;
    if (!isBackfilled && !isManagerView) {
      const { data: transferState } = await admin
        .from("user_transfer_state")
        .select("free_transfers, used_transfers, wildcard_active, free_hit_active")
        .eq("user_id", userId)
        .eq("gameweek_id", statsGwId)
        .maybeSingle();

      if (transferState) {
        freeTransfers = transferState.free_transfers ?? 0;
        usedTransfers = transferState.used_transfers ?? 0;
        const isWcOrFh = !!(transferState.wildcard_active || transferState.free_hit_active);
        transferCost = computeTransferCost(freeTransfers, usedTransfers, isWcOrFh);
      }
    }

    // ── 5b. Fetch team name (always — used in header) ──
    let teamName: string | null = null;
    {
      const { data: ft } = await admin
        .from("fantasy_teams")
        .select("name")
        .eq("user_id", userId)
        .maybeSingle();
      teamName = ft?.name ?? null;
    }

    // ── 5c. Compute league-wide average and highest for this GW ──
    // Uses the real scoring engine (computeUserScore) so numbers match
    // the dedicated /api/rosters/highest route exactly.
    // Uses statsGwId (not gwId) so rollover GWs stay consistent.
    let averagePoints: number | null = null;
    let highestPoints: number | null = null;
    let gwRank: number | null = null;
    let totalManagers: number | null = null;
    let highestUserId: string | null = null;

    if (gwMatchIds.length > 0) {
      const { data: allRosters } = await admin
        .from("user_rosters")
        .select("user_id, player_id, is_starting_9, is_captain, is_vice_captain, multiplier, active_chip, bench_order")
        .eq("gameweek_id", statsGwId);

      if (allRosters && allRosters.length > 0) {
        // Collect all player IDs across every user's roster
        const allPlayerIds = [...new Set(allRosters.map((r: any) => String(r.player_id)))];

        // Fetch ALL events for this GW's matches (action-based, matching scoring engine)
        const { data: allEvents } = await admin
          .from("player_match_events")
          .select("player_id, action, quantity, points_awarded")
          .in("match_id", gwMatchIds);

        // Also fetch did_play from player_stats for all players
        const { data: allStatsData } = await admin
          .from("player_stats")
          .select("player_id, did_play")
          .eq("gameweek_id", statsGwId)
          .in("player_id", allPlayerIds);

        // Fetch player metadata (position, is_lady) for formation & lady-swap checks
        const { data: allPlayerMeta } = await admin
          .from("players")
          .select("id, position, is_lady")
          .in("id", allPlayerIds);

        const allMetaMap = new Map<string, PlayerMeta>();
        for (const p of allPlayerMeta ?? []) {
          allMetaMap.set(String(p.id), {
            id: String(p.id),
            position: p.position,
            is_lady: p.is_lady,
          });
        }

        // Build points map from events using scoring rules (same as scoring engine)
        const allPointsMap = new Map<string, number>();
        const allPlayedFromEvents = new Set<string>();
        const allHasAppearance = new Set<string>();
        for (const e of allEvents ?? []) {
          const pid = String(e.player_id);
          const meta = allMetaMap.get(pid);
          const position = norm(meta?.position);
          const isLady = meta?.is_lady ?? false;
          // Bonus uses stored points_awarded directly (not from scoring_rules)
          const pts = e.action === "bonus"
            ? (e.points_awarded ?? 0) * (e.quantity ?? 1)
            : lookupPoints(rules, e.action, position, isLady) * (e.quantity ?? 1);
          allPointsMap.set(pid, (allPointsMap.get(pid) ?? 0) + pts);
          allPlayedFromEvents.add(pid);
          if (e.action === "appearance" || e.action === "sub_appearance") allHasAppearance.add(pid);
        }

        // did_play set from player_stats
        const allPlayedFromStats = new Set<string>();
        for (const s of allStatsData ?? []) {
          if (s.did_play) allPlayedFromStats.add(String(s.player_id));
        }

        // Add appearance points for players who played but lack an appearance event
        for (const pid of allPlayerIds) {
          if (allHasAppearance.has(pid)) continue;
          const played = allPlayedFromEvents.has(pid) || allPlayedFromStats.has(pid);
          if (played) {
            const meta = allMetaMap.get(pid);
            const position = norm(meta?.position);
            const isLady = meta?.is_lady ?? false;
            const appearancePts = lookupPoints(rules, "appearance", position, isLady);
            allPointsMap.set(pid, (allPointsMap.get(pid) ?? 0) + appearancePts);
          }
        }

        // Build statsMap for scoring engine (points + did_play per player)
        const allStatsMap = new Map<string, PlayerStat>();
        for (const pid of allPlayerIds) {
          allStatsMap.set(pid, {
            player_id: pid,
            points: allPointsMap.get(pid) ?? 0,
            did_play: allPlayedFromEvents.has(pid) || allPlayedFromStats.has(pid),
          });
        }

        // Group rosters by user
        const byUser = new Map<string, RosterRow[]>();
        for (const r of allRosters) {
          const uid = String(r.user_id);
          if (!byUser.has(uid)) byUser.set(uid, []);
          byUser.get(uid)!.push({
            user_id: uid,
            player_id: String(r.player_id),
            is_starting_9: r.is_starting_9,
            is_captain: r.is_captain,
            is_vice_captain: r.is_vice_captain,
            multiplier: r.multiplier ?? 1,
            active_chip: r.active_chip ?? null,
            bench_order: r.bench_order ?? null,
          });
        }

        // Run the real scoring engine for each user
        const userScoreEntries: { uid: string; pts: number }[] = [];
        for (const [uid, rows] of byUser) {
          const userResult = computeUserScore(rows, allStatsMap, allMetaMap);
          userScoreEntries.push({ uid, pts: userResult.totalPoints });
        }

        if (userScoreEntries.length > 0) {
          const leagueStats = computeLeagueStats(
            userScoreEntries,
            result.totalPoints,
            isBackfilled,
          );
          if (leagueStats) {
            averagePoints = leagueStats.averagePoints;
            highestPoints = leagueStats.highestPoints;
            gwRank = leagueStats.gwRank;
            totalManagers = leagueStats.totalManagers;
            highestUserId = leagueStats.highestUserId;
          }
        }
      }
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
              penalties: breakdown.penalties,
              assists: breakdown.assists,
              cleanSheet: breakdown.cleanSheet,
              yellowCards: breakdown.yellowCards,
              redCards: breakdown.redCards,
              ownGoals: breakdown.ownGoals,
              bonus: bonusMap.get(pid) ?? 0,
            }
          : bonusMap.has(pid)
            ? { goals: 0, penalties: 0, assists: 0, cleanSheet: false, yellowCards: 0, redCards: 0, ownGoals: 0, bonus: bonusMap.get(pid) ?? 0 }
            : null,
      };
    });

    return NextResponse.json({
      gwId,
      squadIds,
      originalStartingIds,
      effectiveStartingIds,
      captainId,
      viceId,
      totalPoints: result.totalPoints,
      autoSubs: isBackfilled ? [] : result.autoSubs,
      captainActivated: result.captainActivated,
      benchBoost: result.benchBoost,
      activeChip: isBackfilled ? null : activeChip,
      captainMultiplier,
      transferCost,
      freeTransfers,
      usedTransfers,
      players,
      isBackfilled,
      teamName,
      averagePoints,
      highestPoints,
      gwRank,
      totalManagers,
      highestUserId,
      ...(isManagerView && { managerTeamName: teamName }),
    });
  } catch (e: unknown) {
    return apiError("Failed to fetch gameweek details", "GW_DETAILS_FETCH_FAILED", 500, e);
  }
}
