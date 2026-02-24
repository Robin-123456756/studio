// src/app/api/players/route.ts
import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const supabase = getSupabaseServerOrThrow();

  const { searchParams } = new URL(req.url);
  const teamIdRaw = (searchParams.get("team_id") || "").trim();

  const teamId = teamIdRaw ? Number(teamIdRaw) : null;
  if (teamIdRaw && Number.isNaN(teamId)) {
    return NextResponse.json({ error: "Invalid team_id" }, { status: 400 });
  }

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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
  const session = await import("next-auth").then((m) => m.getServerSession());
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    if (updates.team_id !== undefined) allowed.team_id = Number(updates.team_id);
    if (updates.now_cost !== undefined) allowed.now_cost = Number(updates.now_cost);
    if (updates.is_lady !== undefined) allowed.is_lady = !!updates.is_lady;
    if (updates.avatar_url !== undefined) allowed.avatar_url = updates.avatar_url;
    if (updates.status !== undefined) allowed.status = updates.status;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("players")
      .update(allowed)
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ player: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to update player" }, { status: 500 });
  }
}

/** DELETE /api/admin/players — delete a player */
export async function DELETE(req: Request) {
  const session = await import("next-auth").then((m) => m.getServerSession());
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete player" }, { status: 500 });
  }
}
