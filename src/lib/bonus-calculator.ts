import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { norm } from "@/lib/scoring-engine";

/**
 * BPS rule: action + position → bps_value
 * Loaded from the bps_rules table (cached per request).
 */
type BpsRules = Record<string, number>; // key: "action:POSITION" or "action:ALL"

let cachedRules: BpsRules | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function loadBpsRules(): Promise<BpsRules> {
  if (cachedRules && Date.now() - cacheTime < CACHE_TTL_MS) return cachedRules;
  const supabase = getSupabaseServerOrThrow();
  const { data, error } = await supabase.from("bps_rules").select("action, position, bps_value");
  if (error) {
    throw new Error(`loadBpsRules: failed to fetch BPS rules: ${error.message}`);
  }
  const rules: BpsRules = {};
  for (const r of data ?? []) {
    const key = `${r.action}:${r.position ?? "ALL"}`;
    rules[key] = r.bps_value;
  }
  cachedRules = rules;
  cacheTime = Date.now();
  return rules;
}

/** Clear cache (for tests or long-running processes) */
export function clearBpsCache() {
  cachedRules = null;
  cacheTime = 0;
}

function lookupBps(rules: BpsRules, action: string, position: string): number {
  return rules[`${action}:${position}`] ?? rules[`${action}:ALL`] ?? 0;
}

export type BpsEntry = {
  playerId: string;
  playerName: string;
  position: string;
  bpsScore: number;
  bonus: number; // 3, 2, 1, or 0
};

/**
 * Calculate BPS scores for all players in a match, rank them,
 * and return the top performers with FPL-style tie-aware bonus (3/2/1).
 */
export async function calculateMatchBonus(matchId: number): Promise<BpsEntry[]> {
  const supabase = getSupabaseServerOrThrow();
  const rules = await loadBpsRules();

  // 1. Fetch all events for this match (excluding existing bonus rows)
  const { data: events, error: eventsErr } = await supabase
    .from("player_match_events")
    .select("player_id, action, quantity")
    .eq("match_id", matchId)
    .neq("action", "bonus");

  if (eventsErr) {
    throw new Error(`calculateMatchBonus: failed to fetch events for match ${matchId}: ${eventsErr.message}`);
  }

  if (!events || events.length === 0) return [];

  // 2. Fetch player metadata (position, name)
  const playerIds = [...new Set(events.map((e) => e.player_id))];
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, name, web_name, position")
    .in("id", playerIds);

  if (playersErr) {
    throw new Error(`calculateMatchBonus: failed to fetch players for match ${matchId}: ${playersErr.message}`);
  }

  const playerMap = new Map<string, { name: string; position: string }>();
  for (const p of players ?? []) {
    playerMap.set(p.id, {
      name: p.web_name || p.name || "Unknown",
      position: norm(p.position),
    });
  }

  // 3. Calculate BPS score per player
  const bpsMap = new Map<string, number>();
  for (const e of events) {
    const meta = playerMap.get(e.player_id);
    const position = meta?.position ?? "MID";
    const bps = lookupBps(rules, e.action, position) * (e.quantity ?? 1);
    bpsMap.set(e.player_id, (bpsMap.get(e.player_id) ?? 0) + bps);
  }

  // 4. Sort by BPS descending
  const sorted = Array.from(bpsMap.entries())
    .map(([playerId, bpsScore]) => ({
      playerId,
      playerName: playerMap.get(playerId)?.name ?? "Unknown",
      position: playerMap.get(playerId)?.position ?? "MID",
      bpsScore,
      bonus: 0,
    }))
    .sort((a, b) => b.bpsScore - a.bpsScore);

  if (sorted.length === 0) return sorted;

  // 5. FPL-style tie-aware bonus allocation
  //    Pool: [3, 2, 1]. Ties at a rank share the same bonus; next rank(s) are skipped.
  const bonusPool = [3, 2, 1];
  let poolIdx = 0;
  let i = 0;

  while (i < sorted.length && poolIdx < bonusPool.length) {
    // Find all players tied at this BPS score
    const currentBps = sorted[i].bpsScore;
    if (currentBps <= 0) break; // No bonus for negative/zero BPS

    let tieEnd = i;
    while (tieEnd + 1 < sorted.length && sorted[tieEnd + 1].bpsScore === currentBps) {
      tieEnd++;
    }
    const tiedCount = tieEnd - i + 1;

    // All tied players get the same bonus value
    const bonusValue = bonusPool[poolIdx];
    for (let t = i; t <= tieEnd; t++) {
      sorted[t].bonus = bonusValue;
    }

    // Skip forward in pool by the number of tied players
    poolIdx += tiedCount;
    i = tieEnd + 1;
  }

  return sorted;
}

/**
 * Auto-assign bonus points for a match:
 * 1. Calculate BPS scores
 * 2. Atomically: delete old bonus → insert new bonus → recalc total_points
 *
 * Uses `replace_bonus_events` Postgres function so delete/insert/recalc
 * happen in a single transaction — no partial state on failure.
 *
 * Call this after committing stats or updating match scores.
 */
export async function autoAssignBonus(matchId: number): Promise<{
  assigned: { playerId: string; playerName: string; bonus: number }[];
}> {
  const supabase = getSupabaseServerOrThrow();
  const entries = await calculateMatchBonus(matchId);
  const winners = entries.filter((e) => e.bonus > 0);

  // Single atomic RPC: delete old bonus, insert new, recalc total_points
  const { error: rpcErr } = await supabase.rpc("replace_bonus_events", {
    p_match_id: matchId,
    p_new_bonuses: winners.map((w) => ({
      player_id: w.playerId,
      bonus: w.bonus,
    })),
  });

  if (rpcErr) {
    throw new Error(`autoAssignBonus: transaction failed for match ${matchId}: ${rpcErr.message}`);
  }

  return {
    assigned: winners.map((w) => ({
      playerId: w.playerId,
      playerName: w.playerName,
      bonus: w.bonus,
    })),
  };
}
