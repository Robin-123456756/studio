import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { computeStandings } from "@/lib/leaderboard-utils";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseServerOrThrow();

    // null = all users (global leaderboard)
    const leaderboard = await computeStandings(supabase, null);

    return NextResponse.json(
      { leaderboard },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } }
    );
  } catch (e: unknown) {
    return apiError("Failed to load leaderboard", "LEADERBOARD_FAILED", 500, e);
  }
}
