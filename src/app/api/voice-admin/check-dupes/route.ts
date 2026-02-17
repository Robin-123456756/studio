import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export async function POST(request: Request) {
  try {
    const { matchId, entries } = await request.json();

    if (!matchId || !entries) {
      return NextResponse.json({ error: "matchId and entries required" }, { status: 400 });
    }

    const supabase = getSupabaseServerOrThrow();
    const dupes: { player: string; action: string; existing: number; incoming: number }[] = [];

    for (const entry of entries) {
      const playerId = entry.player?.id;
      if (!playerId) continue;

      for (const action of entry.actions || []) {
        const { data } = await supabase
          .from("player_match_events")
          .select("id, quantity")
          .eq("match_id", parseInt(matchId))
          .eq("player_id", playerId)
          .eq("action", action.action);

        if (data && data.length > 0) {
          const existingQty = data.reduce((sum: number, e: any) => sum + (e.quantity || 1), 0);
          dupes.push({
            player: entry.player?.web_name || entry.spoken_name || "Unknown",
            action: action.action,
            existing: existingQty,
            incoming: action.quantity,
          });
        }
      }
    }

    return NextResponse.json({ dupes, hasDupes: dupes.length > 0 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}