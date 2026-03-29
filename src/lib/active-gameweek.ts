import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the gameweek ID that users are currently picking for:
 * - Current GW if not finalized
 * - Otherwise the first unfinalized GW
 * - Fallback to the flagged current GW (end-of-season)
 */
export async function getActiveGameweekId(
  supabase: SupabaseClient,
): Promise<number | null> {
  const { data: allGws } = await supabase
    .from("gameweeks")
    .select("id, is_current, finalized")
    .order("id", { ascending: true });

  const gws = allGws ?? [];
  const flaggedCurrent = gws.find((g) => g.is_current === true) ?? null;
  const activeGw =
    flaggedCurrent && !flaggedCurrent.finalized
      ? flaggedCurrent
      : gws.find((g) => !g.finalized) ?? flaggedCurrent;

  return activeGw?.id ?? null;
}
