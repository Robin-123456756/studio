import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { supabaseServer } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  // Auth: verify the caller is signed in and requesting their own data
  const authClient = await supabaseServer();
  const { data: auth, error: authErr } = await authClient.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();
  const url = new URL(req.url);

  const userId = url.searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "Missing user_id" }, { status: 400 });

  if (userId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

  let rows = data ?? [];

  // FPL pattern: if no roster for this GW, fall back to current_squads
  // (always up-to-date — synced on every roster save)
  if (rows.length === 0) {
    const { data: currentSquad, error: csErr } = await supabase
      .from("current_squads")
      .select("player_id, is_starting, is_captain, is_vice_captain, bench_order")
      .eq("user_id", userId);

    if (!csErr && currentSquad && currentSquad.length > 0) {
      rows = currentSquad.map((r) => ({
        player_id: r.player_id,
        is_starting_9: r.is_starting,
        is_captain: r.is_captain,
        is_vice_captain: r.is_vice_captain,
        multiplier: r.is_captain ? 2 : 1,
      }));
    }
  }

  const multiplierByPlayer = Object.fromEntries(
    rows.map((r) => [String(r.player_id), Number(r.multiplier ?? 1)])
  );

  return NextResponse.json({
    gwId,
    squadIds: rows.map((r) => r.player_id),
    startingIds: rows.filter((r) => r.is_starting_9).map((r) => r.player_id),
    captainId: rows.find((r) => r.is_captain)?.player_id ?? null,
    viceId: rows.find((r) => r.is_vice_captain)?.player_id ?? null,
    multiplierByPlayer,
  });
}
