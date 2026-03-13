/**
 * Pure helpers extracted from /api/fantasy-gw-details for testability.
 *
 * These cover the three critical integration-level calculations that
 * previously lived inline in the API route with no test coverage:
 *   1. Transfer cost computation
 *   2. League-wide stats aggregation (average, highest, rank)
 *   3. Chip stripping on roster rollover
 */

import { computeDenseRank } from "./rank-utils";

// ── Types ─────────────────────────────────────────────────────────────

export type UserScoreEntry = { uid: string; pts: number };

export type LeagueStats = {
  averagePoints: number;
  highestPoints: number;
  gwRank: number | null;
  totalManagers: number;
  highestUserId: string;
};

export type RolloverRow = {
  is_captain: boolean;
  multiplier: number;
  active_chip: string | null;
  [key: string]: unknown;
};

// ── 1. Transfer cost ──────────────────────────────────────────────────

/**
 * Compute the transfer point deduction for a gameweek.
 *
 * Rules:
 *   - Each transfer beyond the free allowance costs 4 points
 *   - Wildcard or Free Hit active → 0 cost (unlimited transfers)
 *   - Negative "used - free" is clamped to 0
 */
export function computeTransferCost(
  freeTransfers: number,
  usedTransfers: number,
  isWildcardOrFreeHit: boolean,
): number {
  if (isWildcardOrFreeHit) return 0;
  return Math.max(0, usedTransfers - freeTransfers) * 4;
}

// ── 2. League-wide stats ──────────────────────────────────────────────

/**
 * Compute league-wide aggregates from per-user scores.
 *
 * Returns average (rounded), highest, GW rank (dense), total managers,
 * and the userId of the highest scorer.
 *
 * `isBackfilled` suppresses rank — the user's virtual roster isn't in
 * the league-wide pool so ranking them would be misleading.
 *
 * Returns null if entries is empty.
 */
export function computeLeagueStats(
  entries: UserScoreEntry[],
  currentUserPoints: number,
  isBackfilled: boolean,
): LeagueStats | null {
  if (entries.length === 0) return null;

  const allPts = entries.map((e) => e.pts);
  const averagePoints = Math.round(
    allPts.reduce((a, b) => a + b, 0) / allPts.length,
  );
  const highestPoints = Math.max(...allPts);
  const totalManagers = entries.length;

  // Find highest scorer (first one wins ties — stable)
  const best = entries.reduce((a, b) => (b.pts > a.pts ? b : a));
  const highestUserId = best.uid;

  // Dense rank (skip for backfilled GWs)
  const gwRank = isBackfilled
    ? null
    : computeDenseRank(allPts, currentUserPoints);

  return { averagePoints, highestPoints, gwRank, totalManagers, highestUserId };
}

// ── 3. Chip stripping on rollover ─────────────────────────────────────

/**
 * Strip one-time chips and reset captain multiplier for rolled-over rosters.
 *
 * Chips (Bench Boost, Triple Captain, Wildcard, Free Hit) are single-use
 * per season and MUST NOT carry over to the next gameweek. The captain
 * multiplier is reset to 2 (normal) in case Triple Captain was active.
 */
export function stripChipsForRollover<T extends RolloverRow>(rows: T[]): T[] {
  return rows.map((r) => ({
    ...r,
    active_chip: null,
    multiplier: r.is_captain ? 2 : 1,
  }));
}
