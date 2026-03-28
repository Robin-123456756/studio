import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllRows } from "@/lib/fetch-all-rows";

export type StandingsEntry = {
  rank: number;
  userId: string;
  teamName: string;
  totalPoints: number;
  gwBreakdown: Record<number, number>;
  movement: number; // positive = moved up, negative = moved down, 0 = same
};

/**
 * Compute ranked standings for a set of user IDs.
 * If userIds is null/undefined, computes for ALL users (global leaderboard).
 */
export async function computeStandings(
  supabase: SupabaseClient,
  userIds?: string[] | null
): Promise<StandingsEntry[]> {
  // 1. Fetch team names
  let teamsQuery = supabase.from("fantasy_teams").select("user_id, name");
  if (userIds) {
    teamsQuery = teamsQuery.in("user_id", userIds);
  }
  const { data: teams } = await teamsQuery;

  // 2. Fetch GW-by-GW scores
  //    Uses fetchAllRows() — grows with users × gameweeks, can exceed 1000 rows
  const allGwScores = await fetchAllRows((from, to) => {
    let q = supabase
      .from("user_weekly_scores")
      .select("user_id, gameweek_id, total_weekly_points")
      .order("gameweek_id", { ascending: true });
    if (userIds) q = q.in("user_id", userIds);
    return q.range(from, to);
  });

  // 3. Aggregate
  const byUser = new Map<string, Record<number, number>>();
  const totalByUser = new Map<string, number>();
  let maxGw = 0;

  for (const s of allGwScores) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, {});
    const pts = Number(s.total_weekly_points ?? 0);
    byUser.get(s.user_id)![s.gameweek_id] = pts;
    totalByUser.set(s.user_id, (totalByUser.get(s.user_id) ?? 0) + pts);
    if (s.gameweek_id > maxGw) maxGw = s.gameweek_id;
  }

  const teamNameMap = new Map<string, string>();
  for (const t of teams ?? []) {
    teamNameMap.set(t.user_id, t.name || "Unnamed Team");
  }

  // Collect all relevant user IDs
  const allIds = new Set([
    ...(teams ?? []).map((t: any) => t.user_id),
    ...totalByUser.keys(),
  ]);

  // If filtering by userIds, intersect
  const filteredIds = userIds
    ? [...allIds].filter((id) => userIds.includes(id))
    : [...allIds];

  // 4. Rank by current totals
  const sorted = filteredIds
    .map((uid) => ({
      userId: uid,
      teamName: teamNameMap.get(uid) || "Unnamed Team",
      totalPoints: totalByUser.get(uid) ?? 0,
      gwBreakdown: byUser.get(uid) ?? {},
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

  // 5. Compute previous-GW totals for movement
  const prevTotalByUser = new Map<string, number>();
  if (maxGw > 0) {
    for (const uid of filteredIds) {
      const gw = byUser.get(uid) ?? {};
      const latestPts = gw[maxGw] ?? 0;
      const total = totalByUser.get(uid) ?? 0;
      prevTotalByUser.set(uid, total - latestPts);
    }
  }

  // Previous ranks
  const prevSorted = [...filteredIds].sort(
    (a, b) => (prevTotalByUser.get(b) ?? 0) - (prevTotalByUser.get(a) ?? 0)
  );
  const prevRankMap = new Map<string, number>();
  prevSorted.forEach((uid, i) => prevRankMap.set(uid, i + 1));

  // 6. Build final entries with movement
  return sorted.map((entry, i) => {
    const currentRank = i + 1;
    const prevRank = prevRankMap.get(entry.userId) ?? currentRank;
    return {
      ...entry,
      rank: currentRank,
      movement: prevRank - currentRank, // positive = moved up
    };
  });
}
