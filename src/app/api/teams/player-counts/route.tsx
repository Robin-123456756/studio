// src/app/api/teams/player-counts/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseServerOrThrow();

  // Count players per team_uuid
  const { data, error } = await supabase
    .from("players")
    .select("team_uuid");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Build counts: { "3": 9, "11": 7, ... }
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = String((row as any).team_id);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return NextResponse.json({ counts });
}
