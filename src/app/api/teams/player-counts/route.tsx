import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = getSupabaseServerOrThrow();

  // group players by team_id and count
  const { data, error } = await supabase
    .from("players")
    .select("team_id", { count: "exact", head: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // data is rows; easiest is to query teams with player counts using a view,
  // but for now we’ll count in JS by fetching minimal columns.
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const key = String((row as any).team_id);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return NextResponse.json({ counts });
}
