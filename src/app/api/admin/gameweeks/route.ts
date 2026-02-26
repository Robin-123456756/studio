import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { requireAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";
const EAT_OFFSET = "+03:00";

function toIsoAssumingEAT(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  const hasZone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw);
  const normalized = hasZone ? raw : `${raw}${EAT_OFFSET}`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** GET /api/admin/gameweeks - list all gameweeks */
export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

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

/** POST /api/admin/gameweeks - create a new gameweek */
export async function POST(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

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

    const normalizedDeadline = deadline_time === null || deadline_time === undefined || deadline_time === ""
      ? null
      : toIsoAssumingEAT(deadline_time);
    if (deadline_time && !normalizedDeadline) {
      return NextResponse.json({ error: "Invalid deadline_time." }, { status: 400 });
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
        deadline_time: normalizedDeadline,
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

/** PATCH /api/admin/gameweeks - update a gameweek (is_current, finalized, deadline) */
export async function PATCH(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const body = await req.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Gameweek ID is required." }, { status: 400 });
    }

    const normalizedUpdates: Record<string, any> = { ...updates };
    if (Object.prototype.hasOwnProperty.call(updates, "deadline_time")) {
      const normalizedDeadline = updates.deadline_time === null || updates.deadline_time === ""
        ? null
        : toIsoAssumingEAT(updates.deadline_time);
      if (updates.deadline_time !== null && updates.deadline_time !== "" && !normalizedDeadline) {
        return NextResponse.json({ error: "Invalid deadline_time." }, { status: 400 });
      }
      normalizedUpdates.deadline_time = normalizedDeadline;
    }

    // If marking as current, unset any existing current GW first
    if (normalizedUpdates.is_current === true) {
      await supabase
        .from("gameweeks")
        .update({ is_current: false })
        .eq("is_current", true);
    }

    const { data, error } = await supabase
      .from("gameweeks")
      .update(normalizedUpdates)
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

/** DELETE /api/admin/gameweeks - delete a gameweek */
export async function DELETE(req: Request) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Gameweek ID is required." }, { status: 400 });
    }

    const gwId = Number(id);
    if (!Number.isFinite(gwId) || gwId < 1) {
      return NextResponse.json({ error: "Gameweek ID must be a positive integer." }, { status: 400 });
    }

    const { data: existing, error: findError } = await supabase
      .from("gameweeks")
      .select("id, is_current")
      .eq("id", gwId)
      .maybeSingle();

    if (findError) {
      return NextResponse.json({ error: findError.message }, { status: 500 });
    }

    if (!existing) {
      return NextResponse.json({ error: "Gameweek not found." }, { status: 404 });
    }

    if (existing.is_current) {
      return NextResponse.json(
        { error: "Cannot delete the current gameweek. Set another gameweek as current first." },
        { status: 400 }
      );
    }

    const { error: deleteError } = await supabase
      .from("gameweeks")
      .delete()
      .eq("id", gwId);

    if (deleteError) {
      if ((deleteError as any).code === "23503") {
        return NextResponse.json(
          {
            error:
              "Cannot delete this gameweek because related records exist (for example matches, picks, scores, transfers, or chips).",
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete gameweek" }, { status: 500 });
  }
}
