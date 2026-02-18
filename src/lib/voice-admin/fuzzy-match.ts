import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import type { MatchedPlayer, FuzzyMatchResult } from "./types";

/**
 * Look up `is_lady` for matched players from RPC strategies
 * (the RPC functions don't return is_lady, so we enrich after).
 */
async function enrichIsLady(
  players: MatchedPlayer[]
): Promise<MatchedPlayer[]> {
  if (players.length === 0) return players;
  const supabase = getSupabaseServerOrThrow();
  const ids = players.map((p) => p.id);
  const { data } = await supabase
    .from("players")
    .select("id, is_lady")
    .in("id", ids);
  const ladyMap = new Map<string, boolean>();
  if (data) {
    for (const row of data) ladyMap.set(row.id, row.is_lady ?? false);
  }
  return players.map((p) => ({ ...p, is_lady: ladyMap.get(p.id) ?? false }));
}

/**
 * Find the best matching player for a spoken name.
 * Uses YOUR existing Supabase client and players/teams tables.
 *
 * Strategy:
 * 1. Exact match on name or web_name (case-insensitive)
 * 2. Exact match on aliases (player_aliases table)
 * 3. PostgreSQL trigram similarity (handles typos)
 * 4. ILIKE partial match (last resort)
 */
export async function matchPlayer(
  spokenName: string
): Promise<FuzzyMatchResult> {
  const supabase = getSupabaseServerOrThrow();
  const normalized = spokenName.trim().toLowerCase();

  // Strategy 1: Exact match on name or web_name
  const { data: exactMatches } = await supabase
    .rpc("match_player_exact", { search_name: normalized });

  if (exactMatches && exactMatches.length === 1) {
    const [enriched] = await enrichIsLady(exactMatches as MatchedPlayer[]);
    return {
      match: enriched,
      candidates: [],
      confidence: 1.0,
      strategy: "exact",
    };
  }

  if (exactMatches && exactMatches.length > 1) {
    const enriched = await enrichIsLady(exactMatches as MatchedPlayer[]);
    return {
      match: null,
      candidates: enriched,
      confidence: 0.5,
      strategy: "exact_ambiguous",
    };
  }

  // Strategy 2: Alias match
  const { data: aliasMatches } = await supabase
    .rpc("match_player_alias", { search_name: normalized });

  if (aliasMatches && aliasMatches.length === 1) {
    const [enriched] = await enrichIsLady(aliasMatches as MatchedPlayer[]);
    return {
      match: enriched,
      candidates: [],
      confidence: 0.95,
      strategy: "alias",
    };
  }

  // Strategy 3: Trigram similarity
  const { data: trigramMatches } = await supabase
    .rpc("match_player_fuzzy", { search_name: normalized });

  if (trigramMatches && trigramMatches.length > 0) {
    const best = trigramMatches[0];
    const enrichedAll = await enrichIsLady(trigramMatches as MatchedPlayer[]);
    if (best.sim_score > 0.6) {
      return {
        match: enrichedAll[0],
        candidates: enrichedAll.slice(1),
        confidence: best.sim_score,
        strategy: "trigram",
      };
    }

    // Low confidence — return as candidates
    return {
      match: null,
      candidates: enrichedAll,
      confidence: best.sim_score,
      strategy: "trigram_low_confidence",
    };
  }

  // Strategy 4: ILIKE partial match
  const { data: partialMatches } = await supabase
    .from("players")
    .select(`
      id,
      name,
      web_name,
      position,
      is_lady,
      teams!inner(name)
    `)
    .or(`name.ilike.%${spokenName}%,web_name.ilike.%${spokenName}%`)
    .limit(5);

  if (partialMatches && partialMatches.length > 0) {
    const mapped = partialMatches.map((p: any) => ({
      id: p.id,
      name: p.name,
      web_name: p.web_name,
      position: p.position,
      team_name: p.teams?.name || "",
      is_lady: p.is_lady ?? false,
    }));

    return {
      match: mapped.length === 1 ? mapped[0] : null,
      candidates: mapped.length === 1 ? [] : mapped,
      confidence: mapped.length === 1 ? 0.7 : 0.4,
      strategy: "ilike",
    };
  }

  // No match at all
  return {
    match: null,
    candidates: [],
    confidence: 0.0,
    strategy: "none",
  };
}

/**
 * Match multiple player names in batch.
 */
export async function matchPlayers(
  spokenNames: string[]
): Promise<Record<string, FuzzyMatchResult>> {
  const results: Record<string, FuzzyMatchResult> = {};
  for (const name of spokenNames) {
    results[name] = await matchPlayer(name);
  }
  return results;
}