import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type Body = {
  userId: string;
  gameweekId: number;
  squadIds: string[];      // 17
  startingIds: string[];   // 10 in your UI (but column name says starting_9)
  captainId: string | null;
  viceId: string | null;
};

export async function POST(req: Request) {
  const supabase = getSupabaseServerOrThrow();
  const body = (await req.json()) as Body;

  const { userId, gameweekId, squadIds, startingIds, captainId, viceId } = body;

  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  if (!gameweekId) return NextResponse.json({ error: "Missing gameweekId" }, { status: 400 });
  if (!Array.isArray(squadIds) || squadIds.length < 1)
    return NextResponse.json({ error: "Squad cannot be empty" }, { status: 400 });

  const startingSet = new Set(startingIds.map(String));
  const capStr = captainId ? String(captainId) : null;
  const viceStr = viceId ? String(viceId) : null;

  // Deduplicate squadIds to avoid unique constraint violations
  const uniqueSquadIds = [...new Set(squadIds.map(String))];

  const rows = uniqueSquadIds.map((pid) => ({
    user_id: userId,
    player_id: pid,
    gameweek_id: gameweekId,
    is_starting_9: startingSet.has(pid),
    is_captain: capStr === pid,
    is_vice_captain: viceStr === pid,
    multiplier: capStr === pid ? 2 : 1,
  }));

  // Step 1: Upsert all current squad players (insert or update)
  const { error: upsertErr } = await supabase
    .from("user_rosters")
    .upsert(rows, { onConflict: "user_id,player_id,gameweek_id" });
  if (upsertErr) {
    console.log("UPSERT ERROR /api/rosters/save", upsertErr);
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  // Step 2: Remove any players no longer in the squad
  const { error: delErr } = await supabase
    .from("user_rosters")
    .delete()
    .eq("user_id", userId)
    .eq("gameweek_id", Number(gameweekId))
    .not("player_id", "in", `(${uniqueSquadIds.join(",")})`);
  if (delErr) {
    console.log("CLEANUP ERROR /api/rosters/save", delErr);
    // Non-fatal — squad was saved, just stale rows remain
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
