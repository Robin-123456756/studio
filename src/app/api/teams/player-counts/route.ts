import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseServerOrThrow();

  // group players by team_id and count
  const { data, error } = await supabase
    .from("players")
    .select("team_id", { count: "exact", head: false });

  if (error) return apiError("Failed to fetch player counts", "PLAYER_COUNTS_FETCH_FAILED", 500, error);

  // data is rows; easiest is to query teams with player counts using a view,
  // but for now we’ll count in JS by fetching minimal columns.
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = String((row as any).team_id);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return NextResponse.json({ counts });
}
