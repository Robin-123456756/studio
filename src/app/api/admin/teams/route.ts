import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/teams — list all teams with player counts */
export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();

  const { data, error } = await supabase
    .from("teams")
    .select("id, team_uuid, name, short_name, logo_url, team_code")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Get player counts per team
  const { data: playerCounts } = await supabase
    .from("players")
    .select("team_id");

  const countMap = new Map<number, number>();
  for (const row of playerCounts ?? []) {
    const tid = (row as any).team_id;
    countMap.set(tid, (countMap.get(tid) || 0) + 1);
  }

  const teams = (data ?? []).map((t: any) => ({
    ...t,
    playerCount: countMap.get(t.id) || 0,
  }));

  return NextResponse.json({ teams });
}

/** POST /api/admin/teams — create a new team */
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { name, short_name, logo_url } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }
    if (!short_name?.trim()) {
      return NextResponse.json({ error: "Short name is required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("teams")
      .insert({
        name: name.trim(),
        short_name: short_name.trim(),
        logo_url: logo_url?.trim() || null,
      })
      .select("team_uuid, id, name, short_name, logo_url")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ team: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create team" }, { status: 500 });
  }
}

/** PATCH /api/admin/teams — update a team */
export async function PATCH(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { team_uuid, ...updates } = body;

    if (!team_uuid) {
      return NextResponse.json({ error: "team_uuid is required." }, { status: 400 });
    }

    const allowed: Record<string, any> = {};
    if (updates.name !== undefined) allowed.name = updates.name.trim();
    if (updates.short_name !== undefined) allowed.short_name = updates.short_name.trim();
    if (updates.logo_url !== undefined) allowed.logo_url = updates.logo_url?.trim() || null;

    if (Object.keys(allowed).length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("teams")
      .update(allowed)
      .eq("team_uuid", team_uuid)
      .select("team_uuid, id, name, short_name, logo_url")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ team: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to update team" }, { status: 500 });
  }
}

/** DELETE /api/admin/teams — delete a team */
export async function DELETE(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();

  try {
    const { searchParams } = new URL(req.url);
    const team_uuid = searchParams.get("team_uuid");

    if (!team_uuid) {
      return NextResponse.json({ error: "team_uuid is required." }, { status: 400 });
    }

    // Check for players still on this team
    const { count } = await supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("team_id", (await supabase.from("teams").select("id").eq("team_uuid", team_uuid).single()).data?.id);

    if (count && count > 0) {
      return NextResponse.json(
        { error: `Cannot delete: ${count} player(s) still belong to this team. Remove or reassign them first.` },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("teams")
      .delete()
      .eq("team_uuid", team_uuid);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete team" }, { status: 500 });
  }
}
