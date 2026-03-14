import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/cup/draw
 *
 * Generates the cup bracket from overall league standings.
 * Body: { startingGwId: number }
 *
 * Seeds managers by total points (1st vs last, 2nd vs second-last, etc.).
 * Handles non-power-of-2 with byes for top seeds.
 * Creates all rounds with GW assignments (one round per GW).
 */
export async function POST(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  try {
    const supabase = getSupabaseServerOrThrow();
    const body = await req.json();
    const startingGwId = Number(body.startingGwId);

    if (!Number.isFinite(startingGwId) || startingGwId < 1) {
      return NextResponse.json({ error: "startingGwId is required" }, { status: 400 });
    }

    // Check if cup already exists
    const { count: existingRounds } = await supabase
      .from("cup_rounds")
      .select("id", { count: "exact", head: true });

    if (existingRounds && existingRounds > 0) {
      return NextResponse.json(
        { error: "Cup already exists. Delete existing cup first." },
        { status: 409 }
      );
    }

    // 1. Get all managers with their total points from user_weekly_scores
    const { data: scores } = await supabase
      .from("user_weekly_scores")
      .select("user_id, total_weekly_points");

    if (!scores || scores.length === 0) {
      return NextResponse.json({ error: "No managers with scores found" }, { status: 400 });
    }

    // Aggregate total points per user
    const totals = new Map<string, number>();
    for (const s of scores) {
      const uid = s.user_id;
      totals.set(uid, (totals.get(uid) ?? 0) + (s.total_weekly_points ?? 0));
    }

    // Sort by total points desc (seeding)
    const seeded = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([uid]) => uid);

    const n = seeded.length;
    if (n < 2) {
      return NextResponse.json({ error: "Need at least 2 managers for a cup" }, { status: 400 });
    }

    // 2. Calculate bracket size (next power of 2)
    const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
    const numByes = bracketSize - n;
    const totalRounds = Math.log2(bracketSize);

    // 3. Create round names
    const roundNames: string[] = [];
    for (let r = 0; r < totalRounds; r++) {
      const remaining = bracketSize / Math.pow(2, r);
      if (remaining === 2) roundNames.push("Final");
      else if (remaining === 4) roundNames.push("Semi-Final");
      else if (remaining === 8) roundNames.push("Quarter-Final");
      else roundNames.push(`Round of ${remaining}`);
    }

    // 4. Create all rounds in DB
    const roundIds: number[] = [];
    for (let r = 0; r < totalRounds; r++) {
      const { data: round, error: rErr } = await supabase
        .from("cup_rounds")
        .insert({
          round_number: r + 1,
          round_name: roundNames[r],
          gameweek_id: startingGwId + r,
        })
        .select("id")
        .single();

      if (rErr) throw rErr;
      roundIds.push(round.id);
    }

    // 5. Seed first round matches
    // Standard tournament seeding: 1 vs N, 2 vs N-1, etc.
    // Byes go to the top seeds
    const firstRoundMatches: { user1_id: string; user2_id: string | null; is_bye: boolean }[] = [];
    const bracketSlots: (string | null)[] = new Array(bracketSize).fill(null);

    // Place seeded players
    for (let i = 0; i < n; i++) {
      bracketSlots[i] = seeded[i];
    }

    // Pair up: slot 0 vs slot bracketSize-1, slot 1 vs slot bracketSize-2, etc.
    for (let i = 0; i < bracketSize / 2; i++) {
      const user1 = bracketSlots[i];
      const user2 = bracketSlots[bracketSize - 1 - i];

      if (!user1) continue; // shouldn't happen

      firstRoundMatches.push({
        user1_id: user1,
        user2_id: user2,
        is_bye: user2 === null,
      });
    }

    // Insert first round matches
    const matchInserts = firstRoundMatches.map((m) => ({
      round_id: roundIds[0],
      user1_id: m.user1_id,
      user2_id: m.user2_id,
      is_bye: m.is_bye,
      winner_id: m.is_bye ? m.user1_id : null,
      user1_points: 0,
      user2_points: 0,
    }));

    const { error: mErr } = await supabase.from("cup_matches").insert(matchInserts);
    if (mErr) throw mErr;

    // 6. Create placeholder matches for subsequent rounds
    for (let r = 1; r < totalRounds; r++) {
      const matchCount = bracketSize / Math.pow(2, r + 1);
      const placeholders = Array.from({ length: matchCount }, () => ({
        round_id: roundIds[r],
        user1_id: "00000000-0000-0000-0000-000000000000", // placeholder
        user2_id: null as string | null,
        is_bye: false,
        user1_points: 0,
        user2_points: 0,
      }));

      if (placeholders.length > 0) {
        const { error: pErr } = await supabase.from("cup_matches").insert(placeholders);
        if (pErr) throw pErr;
      }
    }

    return NextResponse.json({
      success: true,
      managers: n,
      bracketSize,
      rounds: totalRounds,
      byes: numByes,
      roundNames,
    });
  } catch (e: unknown) {
    return apiError("Failed to generate cup draw", "CUP_DRAW_FAILED", 500, e);
  }
}
