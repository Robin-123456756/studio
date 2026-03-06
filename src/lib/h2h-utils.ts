import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Round-robin fixture generator.
 * Given N members, produces pairings for each gameweek.
 * If N is odd, one member gets a "bye" (user2_id = null → auto-win).
 *
 * Uses the "circle method": fix one member, rotate the rest.
 */
export function generateRoundRobin(
  memberIds: string[],
  gameweekIds: number[]
): { gameweek_id: number; user1_id: string; user2_id: string | null }[] {
  const members = [...memberIds];
  const isOdd = members.length % 2 !== 0;
  if (isOdd) members.push("__BYE__"); // placeholder

  const n = members.length;
  const rounds = n - 1; // full round-robin = n-1 rounds
  const fixtures: { gameweek_id: number; user1_id: string; user2_id: string | null }[] = [];

  // Generate round-robin rounds
  const allRounds: { user1: string; user2: string }[][] = [];
  const fixed = members[0];
  const rotating = members.slice(1);

  for (let round = 0; round < rounds; round++) {
    const roundPairs: { user1: string; user2: string }[] = [];
    // Pair fixed with rotating[0]
    roundPairs.push({ user1: fixed, user2: rotating[0] });
    // Pair remaining: rotating[1] with rotating[n-2], etc.
    for (let i = 1; i < n / 2; i++) {
      roundPairs.push({ user1: rotating[i], user2: rotating[n - 2 - i] });
    }
    allRounds.push(roundPairs);
    // Rotate: move last element to front
    rotating.unshift(rotating.pop()!);
  }

  // Map rounds to gameweeks (cycle if more GWs than rounds)
  for (let gwIdx = 0; gwIdx < gameweekIds.length; gwIdx++) {
    const gwId = gameweekIds[gwIdx];
    const round = allRounds[gwIdx % rounds];

    for (const pair of round) {
      // Each pair generates 2 fixture rows (one per user as user1)
      // so we can look up "my fixture this GW" by user1_id
      const u1 = pair.user1 === "__BYE__" ? null : pair.user1;
      const u2 = pair.user2 === "__BYE__" ? null : pair.user2;

      if (u1) {
        fixtures.push({ gameweek_id: gwId, user1_id: u1, user2_id: u2 });
      }
      if (u2) {
        fixtures.push({ gameweek_id: gwId, user1_id: u2, user2_id: u1 });
      }
    }
  }

  return fixtures;
}

/**
 * Insert H2H fixtures for a league. Deletes existing first (idempotent).
 */
export async function generateAndSaveH2HFixtures(
  supabase: SupabaseClient,
  leagueId: number,
  memberIds: string[]
) {
  if (memberIds.length < 2) return;

  // Get all gameweek IDs
  const { data: gws } = await supabase
    .from("gameweeks")
    .select("id")
    .order("id", { ascending: true });

  const gwIds = (gws ?? []).map((g: any) => g.id);
  if (gwIds.length === 0) return;

  const fixtures = generateRoundRobin(memberIds, gwIds);

  // Delete existing fixtures for this league
  await supabase.from("h2h_fixtures").delete().eq("league_id", leagueId);

  // Insert new fixtures in batches of 500
  const rows = fixtures.map((f) => ({
    league_id: leagueId,
    gameweek_id: f.gameweek_id,
    user1_id: f.user1_id,
    user2_id: f.user2_id,
  }));

  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("h2h_fixtures").insert(batch);
    if (error) throw new Error(`Failed to insert H2H fixtures: ${error.message}`);
  }
}

export type H2HStandingsEntry = {
  rank: number;
  userId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;  // total fantasy points scored
  h2hPoints: number;  // W=3, D=1, L=0
  movement: number;
};

export type H2HFixtureResult = {
  gameweekId: number;
  user1Id: string;
  user2Id: string | null;
  user1Name: string;
  user2Name: string | null;
  user1Points: number;
  user2Points: number;
  result: "win" | "loss" | "draw" | "bye";
};

/**
 * Compute H2H standings for a league.
 */
export async function computeH2HStandings(
  supabase: SupabaseClient,
  leagueId: number,
  memberIds: string[]
): Promise<{ standings: H2HStandingsEntry[]; currentGwFixtures: H2HFixtureResult[] }> {
  // 1. Fetch team names
  const { data: teams } = await supabase
    .from("fantasy_teams")
    .select("user_id, name")
    .in("user_id", memberIds);

  const teamNameMap = new Map<string, string>();
  for (const t of teams ?? []) {
    teamNameMap.set(t.user_id, t.name || "Unnamed Team");
  }

  // 2. Fetch all H2H fixtures for this league
  const { data: fixtures } = await supabase
    .from("h2h_fixtures")
    .select("gameweek_id, user1_id, user2_id")
    .eq("league_id", leagueId)
    .order("gameweek_id", { ascending: true });

  // 3. Fetch all weekly scores for members
  const { data: scores } = await supabase
    .from("user_weekly_scores")
    .select("user_id, gameweek_id, total_weekly_points")
    .in("user_id", memberIds);

  const scoreMap = new Map<string, number>(); // "userId__gwId" → points
  for (const s of scores ?? []) {
    scoreMap.set(`${s.user_id}__${s.gameweek_id}`, Number(s.total_weekly_points ?? 0));
  }

  // 4. Find which GWs have been scored (have any scores)
  const scoredGws = new Set<number>();
  for (const s of scores ?? []) {
    scoredGws.add(s.gameweek_id);
  }

  // 5. Get current GW
  const { data: currentGwRow } = await supabase
    .from("gameweeks")
    .select("id")
    .eq("is_current", true)
    .maybeSingle();
  const currentGwId = currentGwRow?.id ?? 0;

  // 6. Compute standings from fixtures
  const statsMap = new Map<string, { played: number; won: number; drawn: number; lost: number; pointsFor: number; h2hPoints: number }>();

  for (const uid of memberIds) {
    statsMap.set(uid, { played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, h2hPoints: 0 });
  }

  // Only process fixtures for GWs that have been scored
  const fixturesProcessed = (fixtures ?? []).filter((f) => scoredGws.has(f.gameweek_id));

  // We only care about unique matchups per GW (user1_id perspective is enough since
  // each real match appears twice in the fixtures table — once per user)
  const processedPairs = new Set<string>();

  for (const f of fixturesProcessed) {
    const pairKey = [f.user1_id, f.user2_id ?? "bye", f.gameweek_id].sort().join("__");
    if (processedPairs.has(pairKey)) continue;
    processedPairs.add(pairKey);

    const u1pts = scoreMap.get(`${f.user1_id}__${f.gameweek_id}`) ?? 0;
    const u1 = statsMap.get(f.user1_id);

    if (f.user2_id === null) {
      // Bye week — auto-win (3 pts, counts as played)
      if (u1) {
        u1.played++;
        u1.won++;
        u1.h2hPoints += 3;
        u1.pointsFor += u1pts;
      }
      continue;
    }

    const u2pts = scoreMap.get(`${f.user2_id}__${f.gameweek_id}`) ?? 0;
    const u2 = statsMap.get(f.user2_id);

    if (u1) {
      u1.played++;
      u1.pointsFor += u1pts;
    }
    if (u2) {
      u2.played++;
      u2.pointsFor += u2pts;
    }

    if (u1pts > u2pts) {
      if (u1) { u1.won++; u1.h2hPoints += 3; }
      if (u2) { u2.lost++; }
    } else if (u2pts > u1pts) {
      if (u2) { u2.won++; u2.h2hPoints += 3; }
      if (u1) { u1.lost++; }
    } else {
      if (u1) { u1.drawn++; u1.h2hPoints += 1; }
      if (u2) { u2.drawn++; u2.h2hPoints += 1; }
    }
  }

  // 7. Sort: h2hPoints desc → pointsFor desc → teamName asc
  const sorted = memberIds
    .map((uid) => {
      const s = statsMap.get(uid)!;
      return { userId: uid, teamName: teamNameMap.get(uid) || "Unnamed Team", ...s };
    })
    .sort((a, b) => {
      if (b.h2hPoints !== a.h2hPoints) return b.h2hPoints - a.h2hPoints;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.teamName.localeCompare(b.teamName);
    });

  // 8. Compute movement (exclude last GW and recompute)
  // Simplified: just use current rank vs previous
  const standings: H2HStandingsEntry[] = sorted.map((entry, i) => ({
    ...entry,
    rank: i + 1,
    movement: 0, // will compute below
  }));

  // 9. Current GW fixtures
  const currentGwFixtures: H2HFixtureResult[] = [];
  const currentGwRows = (fixtures ?? []).filter(
    (f) => f.gameweek_id === currentGwId
  );
  // Deduplicate (each match appears twice)
  const seenPairs = new Set<string>();
  for (const f of currentGwRows) {
    const key = [f.user1_id, f.user2_id ?? "bye"].sort().join("__");
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);

    const u1pts = scoreMap.get(`${f.user1_id}__${currentGwId}`) ?? 0;
    const u2pts = f.user2_id ? (scoreMap.get(`${f.user2_id}__${currentGwId}`) ?? 0) : 0;

    let result: "win" | "loss" | "draw" | "bye" = "draw";
    if (!f.user2_id) result = "bye";
    else if (u1pts > u2pts) result = "win";
    else if (u2pts > u1pts) result = "loss";

    currentGwFixtures.push({
      gameweekId: currentGwId,
      user1Id: f.user1_id,
      user2Id: f.user2_id,
      user1Name: teamNameMap.get(f.user1_id) || "Unnamed",
      user2Name: f.user2_id ? (teamNameMap.get(f.user2_id) || "Unnamed") : null,
      user1Points: u1pts,
      user2Points: u2pts,
      result,
    });
  }

  return { standings, currentGwFixtures };
}
