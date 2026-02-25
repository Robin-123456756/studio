/**
 * Fantasy Scoring Engine
 *
 * Computes gameweek scores for all users with:
 *   - Auto-substitution (bench players replace absent starters)
 *   - Vice-captain activation (if captain didn't play)
 *   - Bench Boost chip (all 17 score)
 *   - Triple Captain chip (3x instead of 2x)
 *
 * Replaces the opaque Supabase RPCs (calculate_gameweek_scores, finalize_gameweek_scores).
 */

import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

// ── Position normalization (mirrors roster-validation.ts) ─────────────

function norm(pos: string | null | undefined): string {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "GK";
  if (p === "def" || p === "defender" || p === "df") return "DEF";
  if (p === "mid" || p === "midfielder" || p === "mf") return "MID";
  if (p === "fwd" || p === "forward" || p === "fw" || p === "striker") return "FWD";
  return "MID";
}

// ── Types ─────────────────────────────────────────────────────────────

type AutoSub = { outId: string; inId: string; reason: string };

type UserResult = {
  userId: string;
  totalPoints: number;
  autoSubs: AutoSub[];
  captainActivated: "captain" | "vice" | "none";
  benchBoost: boolean;
};

type ScoringResult = {
  results: UserResult[];
  summary: { usersScored: number; gameweekId: number };
};

type RosterRow = {
  user_id: string;
  player_id: string;
  is_starting_9: boolean;
  is_captain: boolean;
  is_vice_captain: boolean;
  multiplier: number;
  active_chip: string | null;
  bench_order: number | null;
};

type PlayerMeta = {
  id: string;
  position: string | null;
  is_lady: boolean | null;
};

type PlayerStat = {
  player_id: string;
  points: number;
  did_play: boolean;
};

// ── Formation validation helper ───────────────────────────────────────

function isValidFormation(positions: string[]): boolean {
  const counts: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
  for (const pos of positions) counts[pos] = (counts[pos] ?? 0) + 1;

  return (
    counts.GK === 1 &&
    counts.DEF >= 2 && counts.DEF <= 3 &&
    counts.MID >= 3 && counts.MID <= 5 &&
    counts.FWD >= 2 && counts.FWD <= 3
  );
}

/**
 * Check whether substituting `outPlayer` with `inPlayer` keeps a valid formation
 * and respects positional swap rules (GK↔GK, lady↔lady).
 */
function canSubstitute(
  outPlayer: PlayerMeta,
  inPlayer: PlayerMeta,
  currentStartingPositions: string[],
): boolean {
  const outPos = norm(outPlayer.position);
  const inPos = norm(inPlayer.position);

  // GK can only swap with GK
  if (outPos === "GK" && inPos !== "GK") return false;
  if (outPos !== "GK" && inPos === "GK") return false;

  // Lady can only swap with lady
  if (outPlayer.is_lady && !inPlayer.is_lady) return false;
  if (!outPlayer.is_lady && inPlayer.is_lady) return false;

  // Check formation remains valid after the swap
  const newPositions = currentStartingPositions
    .filter((p) => p !== outPos || !currentStartingPositions.includes(outPos))
    // Replace the first occurrence of outPos with inPos
    .slice(); // safety copy

  const idx = currentStartingPositions.indexOf(outPos);
  if (idx === -1) return false;
  const proposed = [...currentStartingPositions];
  proposed[idx] = inPos;

  return isValidFormation(proposed);
}

// ── Per-user score computation (exported for reuse) ───────────────────

export function computeUserScore(
  rosterRows: RosterRow[],
  statsMap: Map<string, PlayerStat>,
  metaMap: Map<string, PlayerMeta>,
): UserResult {
  const userId = rosterRows[0]?.user_id ?? "";
  const autoSubs: AutoSub[] = [];

  // Partition into starters and bench
  const starters = rosterRows.filter((r) => r.is_starting_9);
  const bench = rosterRows
    .filter((r) => !r.is_starting_9)
    .sort((a, b) => (a.bench_order ?? 99) - (b.bench_order ?? 99));

  // Determine which starters actually played
  const didPlay = (pid: string): boolean => {
    const stat = statsMap.get(pid);
    return stat?.did_play === true;
  };

  const getPoints = (pid: string): number => {
    return statsMap.get(pid)?.points ?? 0;
  };

  // Build the effective starting set via auto-substitution
  const effectiveStarting = new Set<string>();
  const usedBench = new Set<string>();

  // First, add all starters who played
  for (const s of starters) {
    if (didPlay(s.player_id)) {
      effectiveStarting.add(s.player_id);
    }
  }

  // Current starting positions (only those who played)
  const currentStartingPositions: string[] = [];
  for (const pid of effectiveStarting) {
    const meta = metaMap.get(pid);
    if (meta) currentStartingPositions.push(norm(meta.position));
  }

  // Auto-sub: for each starter who didn't play, try to find a valid bench replacement
  for (const s of starters) {
    if (effectiveStarting.has(s.player_id)) continue; // already playing

    const outMeta = metaMap.get(s.player_id);
    if (!outMeta) continue;

    let subFound = false;
    for (const b of bench) {
      if (usedBench.has(b.player_id)) continue;
      if (!didPlay(b.player_id)) continue;

      const inMeta = metaMap.get(b.player_id);
      if (!inMeta) continue;

      // Test formation validity: add inPlayer's position to current starting
      const testPositions = [...currentStartingPositions, norm(inMeta.position)];
      // We need 10 starters total. Check if adding this bench player
      // and NOT having outPlayer still gives a valid formation.
      // Since outPlayer was already excluded from currentStartingPositions,
      // we just check if testPositions forms a valid 10.

      // But we also need to check positional rules (GK↔GK, lady↔lady)
      const outPos = norm(outMeta.position);
      const inPos = norm(inMeta.position);

      // GK only swaps with GK
      if (outPos === "GK" && inPos !== "GK") continue;
      if (outPos !== "GK" && inPos === "GK") continue;

      // Lady only swaps with lady
      if (outMeta.is_lady && !inMeta.is_lady) continue;
      if (!outMeta.is_lady && inMeta.is_lady) continue;

      // Check if adding this bench player produces a valid formation of 10
      if (testPositions.length === 10 && !isValidFormation(testPositions)) continue;
      if (testPositions.length < 10) {
        // Not yet at 10 starters — we'll validate at the end
        // For now just check the position swap is reasonable
      }

      // Valid sub found
      effectiveStarting.add(b.player_id);
      usedBench.add(b.player_id);
      currentStartingPositions.push(inPos);

      autoSubs.push({
        outId: s.player_id,
        inId: b.player_id,
        reason: `${norm(outMeta.position)} didn't play → subbed ${norm(inMeta.position)} from bench`,
      });
      subFound = true;
      break;
    }

    if (!subFound) {
      // No valid sub — starter stays with 0 points (not added to effectiveStarting)
    }
  }

  // Determine captain / vice-captain activation
  const captainRow = rosterRows.find((r) => r.is_captain);
  const viceRow = rosterRows.find((r) => r.is_vice_captain);

  const isTripleCaptain = rosterRows.some((r) => r.active_chip === "triple_captain");
  const captainMultiplier = isTripleCaptain ? 3 : 2;

  let captainActivated: "captain" | "vice" | "none" = "none";
  let activeCaptainId: string | null = null;

  if (captainRow && effectiveStarting.has(captainRow.player_id) && didPlay(captainRow.player_id)) {
    captainActivated = "captain";
    activeCaptainId = captainRow.player_id;
  } else if (viceRow && effectiveStarting.has(viceRow.player_id) && didPlay(viceRow.player_id)) {
    captainActivated = "vice";
    activeCaptainId = viceRow.player_id;
  }

  // Determine if bench boost is active
  const isBenchBoost = rosterRows.some((r) => r.active_chip === "bench_boost");

  // Build the set of scoring players
  let scoringPlayerIds: Set<string>;
  if (isBenchBoost) {
    // Bench Boost: ALL squad players score (but only those who played get points)
    scoringPlayerIds = new Set(rosterRows.map((r) => r.player_id));
  } else {
    scoringPlayerIds = effectiveStarting;
  }

  // Calculate total
  let totalPoints = 0;
  for (const pid of scoringPlayerIds) {
    const pts = getPoints(pid);
    const multiplier = pid === activeCaptainId ? captainMultiplier : 1;
    totalPoints += pts * multiplier;
  }

  return {
    userId,
    totalPoints,
    autoSubs,
    captainActivated,
    benchBoost: isBenchBoost,
  };
}

// ── Main engine function ──────────────────────────────────────────────

export async function calculateGameweekScores(gameweekId: number): Promise<ScoringResult> {
  const supabase = getSupabaseServerOrThrow();

  // 1. Fetch all rosters for this GW
  const { data: rosters, error: rosterErr } = await supabase
    .from("user_rosters")
    .select("user_id, player_id, is_starting_9, is_captain, is_vice_captain, multiplier, active_chip, bench_order")
    .eq("gameweek_id", gameweekId);

  if (rosterErr) throw new Error(`Failed to fetch rosters: ${rosterErr.message}`);
  if (!rosters || rosters.length === 0) {
    return { results: [], summary: { usersScored: 0, gameweekId } };
  }

  // 2. Collect all player IDs
  const allPlayerIds = [...new Set(rosters.map((r) => String(r.player_id)))];

  // 3. Fetch player_stats for this GW
  const { data: stats, error: statsErr } = await supabase
    .from("player_stats")
    .select("player_id, points, did_play")
    .eq("gameweek_id", gameweekId)
    .in("player_id", allPlayerIds);

  if (statsErr) throw new Error(`Failed to fetch player_stats: ${statsErr.message}`);

  // Build stats map (sum points if multiple rows — shouldn't happen but be safe)
  const statsMap = new Map<string, PlayerStat>();
  for (const s of stats ?? []) {
    const pid = String(s.player_id);
    const existing = statsMap.get(pid);
    if (existing) {
      existing.points += s.points ?? 0;
      if (s.did_play) existing.did_play = true;
    } else {
      statsMap.set(pid, {
        player_id: pid,
        points: s.points ?? 0,
        did_play: s.did_play ?? false,
      });
    }
  }

  // 4. Fetch player metadata (position, is_lady)
  const { data: players, error: playersErr } = await supabase
    .from("players")
    .select("id, position, is_lady")
    .in("id", allPlayerIds);

  if (playersErr) throw new Error(`Failed to fetch players: ${playersErr.message}`);

  const metaMap = new Map<string, PlayerMeta>();
  for (const p of players ?? []) {
    metaMap.set(String(p.id), { id: String(p.id), position: p.position, is_lady: p.is_lady });
  }

  // 5. Group rosters by user
  const byUser = new Map<string, RosterRow[]>();
  for (const row of rosters) {
    const uid = String(row.user_id);
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid)!.push({
      ...row,
      user_id: uid,
      player_id: String(row.player_id),
    });
  }

  // 6. Compute scores per user
  const results: UserResult[] = [];
  for (const [, userRoster] of byUser) {
    results.push(computeUserScore(userRoster, statsMap, metaMap));
  }

  // 7. Upsert into user_weekly_scores
  const upsertRows = results.map((r) => ({
    user_id: r.userId,
    gameweek_id: gameweekId,
    total_weekly_points: r.totalPoints,
  }));

  if (upsertRows.length > 0) {
    const { error: upsertErr } = await supabase
      .from("user_weekly_scores")
      .upsert(upsertRows, { onConflict: "user_id,gameweek_id" });

    if (upsertErr) throw new Error(`Failed to upsert scores: ${upsertErr.message}`);
  }

  return {
    results,
    summary: { usersScored: results.length, gameweekId },
  };
}
