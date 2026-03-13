/**
 * Compute a dense rank for a given score within a pool of scores.
 *
 * Dense rank: [100, 100, 90, 80] → ranks 1, 1, 2, 3
 * (ties share rank, next rank is +1, no gaps)
 *
 * Returns null if the pool is empty or the score cannot be ranked.
 */
export function computeDenseRank(
  allScores: number[],
  userScore: number,
): number | null {
  if (allScores.length === 0) return null;

  const distinct = [...new Set(allScores)].sort((a, b) => b - a);
  const idx = distinct.findIndex((s) => s <= userScore);

  // userScore is below every score in the pool
  if (idx === -1) return distinct.length + 1;

  return idx + 1;
}
