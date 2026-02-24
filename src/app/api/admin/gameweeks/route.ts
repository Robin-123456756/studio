import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/gameweeks — list all gameweeks */
export async function GET() {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();

  const { data, error } = await supabase
    .from("gameweeks")
    .select("*")
    .order("id", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ gameweeks: data ?? [] });
}

/** POST /api/admin/gameweeks — create a new gameweek */
export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { id, name, deadline_time, is_current } = body;

    if (!id && id !== 0) {
      return NextResponse.json({ error: "Gameweek ID is required." }, { status: 400 });
    }

    const gwId = Number(id);
    if (!Number.isFinite(gwId) || gwId < 1) {
      return NextResponse.json({ error: "Gameweek ID must be a positive integer." }, { status: 400 });
    }

    // If marking as current, unset any existing current GW first
    if (is_current) {
      await supabase
        .from("gameweeks")
        .update({ is_current: false })
        .eq("is_current", true);
    }

    const { data, error } = await supabase
      .from("gameweeks")
      .insert({
        id: gwId,
        name: name?.trim() || `Gameweek ${gwId}`,
        deadline_time: deadline_time || null,
        is_current: is_current ?? false,
        finalized: false,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ gameweek: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create gameweek" }, { status: 500 });
  }
}

/** PATCH /api/admin/gameweeks — update a gameweek (is_current, finalized, deadline) */
export async function PATCH(req: Request) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Gameweek ID is required." }, { status: 400 });
    }

    // If marking as current, unset any existing current GW first
    if (updates.is_current === true) {
      await supabase
        .from("gameweeks")
        .update({ is_current: false })
        .eq("is_current", true);
    }

    const { data, error } = await supabase
      .from("gameweeks")
      .update(updates)
      .eq("id", Number(id))
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ gameweek: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to update gameweek" }, { status: 500 });
  }
}
