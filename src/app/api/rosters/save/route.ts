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

  // wipe old roster
  const { error: delErr } = await supabase
    .from("user_rosters")
    .delete()
    .eq("user_id", userId)
    .eq("gameweek_id", Number(gameweekId));

  if (delErr) {
    console.log("DELETE ERROR /api/rosters/save", delErr);
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  // insert new roster — captain gets 2x multiplier
  // (lady 2x is already applied at the base scoring level, not here)
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

  const { error: insErr } = await supabase
    .from("user_rosters")
    .upsert(rows, { onConflict: "user_id,player_id,gameweek_id" });
  if (insErr) {
    console.log("INSERT ERROR /api/rosters/save", insErr);
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, inserted: rows.length });
}
