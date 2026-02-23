import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const TRANSFER_COST_PER_EXTRA = 4;

/**
 * GET /api/transfers?gw_id=N
 * Returns transfer state for the authenticated user and gameweek:
 *   { freeTransfers, usedTransfers, cost, wildcardActive, freeHitActive, transfers }
 */
export async function GET(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = auth.user.id;
  const admin = getSupabaseServerOrThrow();

  const url = new URL(req.url);
  const gwId = Number(url.searchParams.get("gw_id") ?? "");
  if (!Number.isFinite(gwId) || gwId < 1) {
    return NextResponse.json({ error: "gw_id is required" }, { status: 400 });
  }

  // Try to load existing state
  const { data: state } = await admin
    .from("user_transfer_state")
    .select("*")
    .eq("user_id", userId)
    .eq("gameweek_id", gwId)
    .maybeSingle();

  let freeTransfers: number;
  let usedTransfers: number;
  let wildcardActive: boolean;
  let freeHitActive: boolean;

  if (state) {
    freeTransfers = state.free_transfers;
    usedTransfers = state.used_transfers;
    wildcardActive = state.wildcard_active;
    freeHitActive = state.free_hit_active;
  } else {
    // Auto-initialize from previous GW
    const prevGwId = gwId - 1;
    const { data: prev } = prevGwId >= 1
      ? await admin
          .from("user_transfer_state")
          .select("free_transfers, used_transfers")
          .eq("user_id", userId)
          .eq("gameweek_id", prevGwId)
          .maybeSingle()
      : { data: null };

    // Rollover: 1 base + min(1, unused from previous) = max 2
    const unused = prev ? Math.max(0, prev.free_transfers - prev.used_transfers) : 0;
    freeTransfers = Math.min(2, 1 + Math.min(1, unused));
    usedTransfers = 0;
    wildcardActive = false;
    freeHitActive = false;

    // Check if wildcard/free_hit chips were activated for this GW
    const { data: chips } = await admin
      .from("user_chips")
      .select("chip")
      .eq("user_id", userId)
      .eq("gameweek_id", gwId);

    for (const c of chips ?? []) {
      if (c.chip === "wildcard") wildcardActive = true;
      if (c.chip === "free_hit") freeHitActive = true;
    }

    // Persist the initialized state
    await admin.from("user_transfer_state").upsert({
      user_id: userId,
      gameweek_id: gwId,
      free_transfers: freeTransfers,
      used_transfers: 0,
      wildcard_active: wildcardActive,
      free_hit_active: freeHitActive,
    });
  }

  const cost =
    wildcardActive || freeHitActive
      ? 0
      : Math.max(0, usedTransfers - freeTransfers) * TRANSFER_COST_PER_EXTRA;

  // Also fetch the transfer log for this GW
  const { data: transfers } = await admin
    .from("user_transfers")
    .select("id, player_out_id, player_in_id, created_at")
    .eq("user_id", userId)
    .eq("gameweek_id", gwId)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    freeTransfers,
    usedTransfers,
    cost,
    wildcardActive,
    freeHitActive,
    transfers: transfers ?? [],
  });
}

/**
 * POST /api/transfers
 * Body: { gameweekId, playerOutId, playerInId }
 * Records a transfer, increments used_transfers.
 */
export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const userId = auth.user.id;
  const admin = getSupabaseServerOrThrow();

  const body = await req.json().catch(() => null);
  const gameweekId = Number(body?.gameweekId ?? "");
  const playerOutId = body?.playerOutId ? String(body.playerOutId) : null;
  const playerInId = body?.playerInId ? String(body.playerInId) : null;

  if (!Number.isFinite(gameweekId) || gameweekId < 1) {
    return NextResponse.json({ error: "gameweekId is required" }, { status: 400 });
  }
  if (!playerOutId || !playerInId) {
    return NextResponse.json({ error: "playerOutId and playerInId are required" }, { status: 400 });
  }
  if (playerOutId === playerInId) {
    return NextResponse.json({ error: "Cannot transfer a player for themselves" }, { status: 400 });
  }

  // Deadline check
  const { data: gw, error: gwErr } = await admin
    .from("gameweeks")
    .select("id, deadline_time, finished")
    .eq("id", gameweekId)
    .single();

  if (gwErr || !gw) {
    return NextResponse.json({ error: "Gameweek not found" }, { status: 404 });
  }
  if (gw.finished) {
    return NextResponse.json({ error: "Gameweek is finished" }, { status: 403 });
  }
  if (gw.deadline_time) {
    const deadline = new Date(gw.deadline_time);
    if (Date.now() > deadline.getTime()) {
      return NextResponse.json({ error: "Deadline has passed" }, { status: 403 });
    }
  }

  // Validate both players exist
  const { data: playersCheck } = await admin
    .from("players")
    .select("id")
    .in("id", [playerOutId, playerInId]);

  const foundIds = new Set((playersCheck ?? []).map((p) => p.id));
  if (!foundIds.has(playerOutId)) {
    return NextResponse.json({ error: `Player out ${playerOutId} not found` }, { status: 400 });
  }
  if (!foundIds.has(playerInId)) {
    return NextResponse.json({ error: `Player in ${playerInId} not found` }, { status: 400 });
  }

  // Record transfer
  const { error: transferErr } = await admin
    .from("user_transfers")
    .insert({
      user_id: userId,
      gameweek_id: gameweekId,
      player_out_id: playerOutId,
      player_in_id: playerInId,
    });

  if (transferErr) {
    console.error("TRANSFER INSERT ERROR", transferErr);
    return NextResponse.json({ error: "Failed to record transfer" }, { status: 500 });
  }

  // Ensure state row exists, then increment used_transfers
  const { data: state } = await admin
    .from("user_transfer_state")
    .select("*")
    .eq("user_id", userId)
    .eq("gameweek_id", gameweekId)
    .maybeSingle();

  if (!state) {
    // Auto-initialize (same logic as GET)
    const prevGwId = gameweekId - 1;
    const { data: prev } = prevGwId >= 1
      ? await admin
          .from("user_transfer_state")
          .select("free_transfers, used_transfers")
          .eq("user_id", userId)
          .eq("gameweek_id", prevGwId)
          .maybeSingle()
      : { data: null };

    const unused = prev ? Math.max(0, prev.free_transfers - prev.used_transfers) : 0;
    const freeTransfers = Math.min(2, 1 + Math.min(1, unused));

    // Check chips
    const { data: chips } = await admin
      .from("user_chips")
      .select("chip")
      .eq("user_id", userId)
      .eq("gameweek_id", gameweekId);

    let wildcardActive = false;
    let freeHitActive = false;
    for (const c of chips ?? []) {
      if (c.chip === "wildcard") wildcardActive = true;
      if (c.chip === "free_hit") freeHitActive = true;
    }

    await admin.from("user_transfer_state").upsert({
      user_id: userId,
      gameweek_id: gameweekId,
      free_transfers: freeTransfers,
      used_transfers: 1,
      wildcard_active: wildcardActive,
      free_hit_active: freeHitActive,
    });
  } else {
    // Increment used
    const { error: updateErr } = await admin
      .from("user_transfer_state")
      .update({ used_transfers: state.used_transfers + 1 })
      .eq("user_id", userId)
      .eq("gameweek_id", gameweekId);

    if (updateErr) {
      console.error("TRANSFER STATE UPDATE ERROR", updateErr);
      return NextResponse.json({ error: "Failed to update transfer state" }, { status: 500 });
    }
  }

  // Return updated state
  const { data: updated } = await admin
    .from("user_transfer_state")
    .select("*")
    .eq("user_id", userId)
    .eq("gameweek_id", gameweekId)
    .single();

  const cost =
    updated && (updated.wildcard_active || updated.free_hit_active)
      ? 0
      : Math.max(0, (updated?.used_transfers ?? 1) - (updated?.free_transfers ?? 1)) *
        TRANSFER_COST_PER_EXTRA;

  return NextResponse.json({
    ok: true,
    freeTransfers: updated?.free_transfers ?? 1,
    usedTransfers: updated?.used_transfers ?? 1,
    cost,
  });
}
