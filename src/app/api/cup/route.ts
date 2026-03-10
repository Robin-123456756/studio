import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/cup
 *
 * Returns the full cup bracket: all rounds with matches,
 * enriched with team names.
 */
export async function GET() {
  try {
    const authClient = await supabaseServer();
    const { data: auth, error: authErr } = await authClient.auth.getUser();
    if (authErr || !auth?.user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }

    const supabase = getSupabaseServerOrThrow();

    // 1. Fetch all rounds
    const { data: rounds, error: rErr } = await supabase
      .from("cup_rounds")
      .select("id, round_number, round_name, gameweek_id")
      .order("round_number", { ascending: true });

    if (rErr) throw rErr;

    if (!rounds || rounds.length === 0) {
      return NextResponse.json({ rounds: [], matches: [] });
    }

    const roundIds = rounds.map((r) => r.id);

    // 2. Fetch all matches
    const { data: matches, error: mErr } = await supabase
      .from("cup_matches")
      .select("id, round_id, user1_id, user2_id, user1_points, user2_points, winner_id, is_bye")
      .in("round_id", roundIds)
      .order("id", { ascending: true });

    if (mErr) throw mErr;

    // 3. Collect all user IDs for team name lookup
    const PLACEHOLDER = "00000000-0000-0000-0000-000000000000";
    const userIds = new Set<string>();
    for (const m of matches ?? []) {
      if (m.user1_id && m.user1_id !== PLACEHOLDER) userIds.add(m.user1_id);
      if (m.user2_id && m.user2_id !== PLACEHOLDER) userIds.add(m.user2_id);
    }

    const teamNameMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: teams } = await supabase
        .from("fantasy_teams")
        .select("user_id, name")
        .in("user_id", [...userIds]);

      for (const t of teams ?? []) {
        teamNameMap.set(t.user_id, t.name);
      }
    }

    // 4. Build response
    const enrichedMatches = (matches ?? []).map((m) => ({
      id: m.id,
      roundId: m.round_id,
      user1Id: m.user1_id === PLACEHOLDER ? null : m.user1_id,
      user2Id: m.user2_id,
      user1Name: m.user1_id === PLACEHOLDER ? "TBD" : (teamNameMap.get(m.user1_id) ?? "Unknown"),
      user2Name: m.user2_id ? (teamNameMap.get(m.user2_id) ?? "Unknown") : (m.is_bye ? "Bye" : "TBD"),
      user1Points: m.user1_points ?? 0,
      user2Points: m.user2_points ?? 0,
      winnerId: m.winner_id,
      isBye: m.is_bye ?? false,
    }));

    const res = NextResponse.json({
      rounds,
      matches: enrichedMatches,
      currentUserId: auth.user.id,
    });
    res.headers.set("Cache-Control", "s-maxage=30, stale-while-revalidate=60");
    return res;
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Route crashed" },
      { status: 500 }
    );
  }
}
