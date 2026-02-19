import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import type { AIAction, PointsBreakdownItem } from "./types";

// In-memory cache for scoring rules
let rulesCache: Record<string, number> | null = null;

/**
 * Load scoring rules from YOUR existing scoring_rules table.
 * Caches in memory — rules rarely change mid-session.
 */
async function loadRules(): Promise<Record<string, number>> {
  if (rulesCache) return rulesCache;

  const supabase = getSupabaseServerOrThrow();
  const { data, error } = await supabase
    .from("scoring_rules")
    .select("action, position, points");

  if (error) throw new Error(`Failed to load scoring rules: ${error.message}`);

  rulesCache = {};
  for (const row of data || []) {
    rulesCache[`${row.action}:${row.position || "ALL"}`] = row.points;
  }

  console.log(`[Points] Loaded ${data?.length || 0} scoring rules`);
  return rulesCache;
}

/**
 * Calculate points for a single action given a player's position.
 * Checks position-specific rule first, falls back to "ALL".
 */
export async function calcPoints(
  action: string,
  position: string
): Promise<number> {
  const rules = await loadRules();

  // Position-specific rule first
  const specific = rules[`${action}:${position}`];
  if (specific !== undefined) return specific;

  // Fall back to ALL
  const all = rules[`${action}:ALL`];
  if (all !== undefined) return all;

  console.warn(`[Points] No rule for action="${action}" position="${position}"`);
  return 0;
}

/**
 * Calculate total points for a player's full stat line.
 */
export async function calcTotalPoints(
  actions: AIAction[],
  position: string
): Promise<{ total: number; breakdown: PointsBreakdownItem[] }> {
  const breakdown: PointsBreakdownItem[] = [];
  let total = 0;

  for (const { action, quantity } of actions) {
    const pointsPerUnit = await calcPoints(action, position);
    const subtotal = pointsPerUnit * quantity;

    breakdown.push({
      action: action as any,
      quantity,
      points_per_unit: pointsPerUnit,
      subtotal,
    });

    total += subtotal;
  }

  return { total, breakdown };
}

/** Force reload of scoring rules. */
export function invalidateRulesCache() {
  rulesCache = null;
}