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
  if (!Array.isArray(squadIds) || squadIds.length !== 17)
    return NextResponse.json({ error: "Squad must be exactly 17" }, { status: 400 });

  // wipe old roster
  const { error: delErr } = await supabase
    .from("user_rosters")
    .delete()
    .eq("user_id", userId)
    .eq("gameweek_id", gameweekId);

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  // Look up which players are ladies for auto-double
  const { data: ladyData } = await supabase
    .from("players")
    .select("id, is_lady")
    .in("id", squadIds)
    .eq("is_lady", true);
  const ladyIds = new Set((ladyData ?? []).map((p: any) => p.id));

  // insert new roster — ladies get multiplier 2 (same as captain)
  const rows = squadIds.map((playerId) => ({
    user_id: userId,
    player_id: playerId,
    gameweek_id: gameweekId,
    is_starting_9: startingIds.includes(playerId),
    is_captain: captainId === playerId,
    is_vice_captain: viceId === playerId,
    multiplier: (captainId === playerId || ladyIds.has(playerId)) ? 2 : 1,
  }));

  const { error: insErr } = await supabase.from("user_rosters").insert(rows);
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, inserted: rows.length });
}
