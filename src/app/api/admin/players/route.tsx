// src/app/api/players/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession, SUPER_ADMIN_ONLY } from "@/lib/admin-auth";
import { apiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const supabase = getSupabaseServerOrThrow();

  const { searchParams } = new URL(req.url);
  const teamIdRaw = (searchParams.get("team_id") || "").trim();

  const teamId = teamIdRaw || null;

  let query = supabase
    .from("players")
    .select(
      `
      id,
      name,
      web_name,
      position,
      team_id,
      now_cost,
      total_points,
      avatar_url,
      is_lady,
      status,
      teams:team_id (
        id,
        name,
        short_name
      )
    `
    )
    .order("web_name", { ascending: true });

  if (teamId !== null) query = query.eq("team_id", teamId);

  const { data, error } = await query;
  if (error) return apiError("Failed to fetch players", "PLAYERS_FETCH_FAILED", 500, error);

  // ✅ map into the UI shape your Fantasy/Pick pages expect
  const players = (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.web_name ?? p.name,          // card name (use web_name)
    fullName: p.name ?? p.web_name,      // optional if you want both
    position: p.position,
    price: Number(p.now_cost ?? 0),
    points: Number(p.total_points ?? 0),
    avatarUrl: p.avatar_url,
    isLady: !!p.is_lady,
    teamId: p.team_id,
    teamName: p.teams?.name ?? null,       // ✅ full team name for list view
    teamShort: p.teams?.short_name ?? null, // ✅ short code for pitch view
    status: p.status ?? "available",
  }));

  return NextResponse.json({ players });
}

/** PATCH /api/admin/players — update a player */
export async function PATCH(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Player ID is required." }, { status: 400 });
    }

    // Only allow safe fields
    const allowed: Record<string, any> = {};
    if (updates.name !== undefined) allowed.name = updates.name;
    if (updates.web_name !== undefined) allowed.web_name = updates.web_name;
    if (updates.position !== undefined) allowed.position = updates.position;
    if (updates.team_id !== undefined) allowed.team_id = updates.team_id;
    if (updates.now_cost !== undefined) allowed.now_cost = Number(updates.now_cost);
    if (updates.is_lady !== undefined) allowed.is_lady = !!updates.is_lady;
    if (updates.avatar_url !== undefined) allowed.avatar_url = updates.avatar_url;
    if (updates.status !== undefined) allowed.status = updates.status;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    // If price is changing, fetch old price first for history log
    let oldPrice: number | null = null;
    if (allowed.now_cost !== undefined) {
      const { data: existing } = await supabase
        .from("players")
        .select("now_cost")
        .eq("id", id)
        .maybeSingle();
      oldPrice = existing?.now_cost ?? null;
    }

    const { data, error } = await supabase
      .from("players")
      .update(allowed)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return apiError("Failed to update player", "PLAYER_UPDATE_FAILED", 500, error);
    }

    // Log price change if it actually changed
    if (oldPrice !== null && allowed.now_cost !== undefined && oldPrice !== allowed.now_cost) {
      await supabase.from("player_price_history").insert({
        player_id: id,
        old_price: oldPrice,
        new_price: allowed.now_cost,
      });
    }

    return NextResponse.json({ player: data });
  } catch (e: unknown) {
    return apiError("Failed to update player", "PLAYER_PATCH_FAILED", 500, e);
  }
}

/** DELETE /api/admin/players — delete a player (super_admin only) */
export async function DELETE(req: Request) {
  const { error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Player ID is required." }, { status: 400 });
    }

    const { error } = await supabase
      .from("players")
      .delete()
      .eq("id", id);

    if (error) {
      return apiError("Failed to delete player", "PLAYER_DELETE_FAILED", 500, error);
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return apiError("Failed to delete player", "PLAYER_DELETE_FAILED", 500, e);
  }
}
