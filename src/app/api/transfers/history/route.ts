import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const TRANSFER_COST_PER_EXTRA = 4;

/**
 * GET /api/transfers/history
 * Returns ALL transfers for the authenticated user across every gameweek,
 * enriched with player names/positions/teams/prices, plus cumulative season hits.
 */
export async function GET() {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = auth.user.id;
  const admin = getSupabaseServerOrThrow();

  // 1. Fetch all transfers for this user (newest first)
  const { data: transfers, error: transferErr } = await admin
    .from("user_transfers")
    .select("id, player_out_id, player_in_id, gameweek_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (transferErr) {
    console.error("TRANSFER HISTORY QUERY ERROR", transferErr);
    return NextResponse.json(
      { error: "Failed to load transfer history" },
      { status: 500 },
    );
  }

  // 2. Batch-join with players to enrich with names, positions, team shorts, prices
  const playerIds = new Set<string>();
  for (const t of transfers ?? []) {
    if (t.player_out_id) playerIds.add(t.player_out_id);
    if (t.player_in_id) playerIds.add(t.player_in_id);
  }

  const playerMap = new Map<
    string,
    { name: string; position: string; teamShort: string; price: number | null }
  >();

  if (playerIds.size > 0) {
    const { data: players } = await admin
      .from("players")
      .select(
        "id, name, position, now_cost, teams:teams!players_team_id_fkey (short_name)",
      )
      .in("id", [...playerIds]);

    for (const p of players ?? []) {
      const team = p.teams as any;
      playerMap.set(p.id, {
        name: p.name ?? "",
        position: p.position ?? "",
        teamShort: team?.short_name ?? "",
        price: p.now_cost ?? null,
      });
    }
  }

  // Build enriched transfer list
  const enrichedTransfers = (transfers ?? []).map((t) => {
    const pOut = playerMap.get(t.player_out_id);
    const pIn = playerMap.get(t.player_in_id);
    return {
      gwId: t.gameweek_id,
      ts: t.created_at,
      outId: t.player_out_id,
      inId: t.player_in_id,
      outName: pOut?.name ?? null,
      inName: pIn?.name ?? null,
      outTeamShort: pOut?.teamShort ?? null,
      inTeamShort: pIn?.teamShort ?? null,
      outPos: pOut?.position ?? null,
      inPos: pIn?.position ?? null,
      outPrice: pOut?.price ?? null,
      inPrice: pIn?.price ?? null,
    };
  });

  // 3. Compute cumulative season hits from user_transfer_state
  const { data: states, error: stateErr } = await admin
    .from("user_transfer_state")
    .select(
      "gameweek_id, free_transfers, used_transfers, wildcard_active, free_hit_active",
    )
    .eq("user_id", userId);

  let seasonHits = 0;
  if (!stateErr && states) {
    for (const s of states) {
      // Skip chip-active GWs — no cost during wildcard or free hit
      if (s.wildcard_active || s.free_hit_active) continue;
      const extra = Math.max(0, s.used_transfers - s.free_transfers);
      seasonHits += extra * TRANSFER_COST_PER_EXTRA;
    }
  }

  return NextResponse.json({ transfers: enrichedTransfers, seasonHits });
}
