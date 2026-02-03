import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const supabase = getSupabaseServerOrThrow();
  const url = new URL(req.url);

  const userId = url.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

  const gwIdParam = url.searchParams.get("gw_id");
  let gwId = gwIdParam ? Number(gwIdParam) : NaN;

  if (!Number.isFinite(gwId)) {
    const { data: current, error } = await supabase
      .from("gameweeks")
      .select("id")
      .eq("is_current", true)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    gwId = current?.id ?? NaN;
  }

  if (!Number.isFinite(gwId)) {
    return NextResponse.json({ error: "No gameweek found" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("user_rosters")
    .select("player_id,is_starting_9,is_captain,is_vice_captain,multiplier")
    .eq("user_id", userId)
    .eq("gameweek_id", gwId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = data ?? [];
  return NextResponse.json({
    gwId,
    squadIds: rows.map((r) => r.player_id),
    startingIds: rows.filter((r) => r.is_starting_9).map((r) => r.player_id),
    captainId: rows.find((r) => r.is_captain)?.player_id ?? null,
    viceId: rows.find((r) => r.is_vice_captain)?.player_id ?? null,
  });
}
