/**
 * Paginated Supabase fetch — pulls ALL matching rows in 1000-row batches.
 *
 * Supabase PostgREST has a default row limit (typically 1000). Using
 * `.limit(N)` just moves the ceiling — once exceeded, results are silently
 * truncated. This helper eliminates that risk by paginating with `.range()`.
 *
 * Usage:
 *   const rows = await fetchAllRows((from, to) =>
 *     supabase
 *       .from("player_match_events")
 *       .select("player_id, action, points_awarded")
 *       .in("match_id", matchIds)
 *       .range(from, to)
 *   );
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break; // last page
    offset += pageSize;
  }

  return all;
}
