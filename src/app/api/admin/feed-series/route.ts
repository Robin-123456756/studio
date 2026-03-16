import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, SUPER_ADMIN_ONLY } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET — list all content series */
export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();
  const { data, error } = await supabase
    .from("feed_media_series")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ series: data ?? [] });
}

/** POST — create a new series */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const body = await req.json();
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Series name is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerOrThrow();
  const { data, error } = await supabase
    .from("feed_media_series")
    .insert({ name: body.name.trim(), description: body.description || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ series: data }, { status: 201 });
}

/** DELETE — remove a series */
export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Series ID required." }, { status: 400 });

  const supabase = getSupabaseServerOrThrow();
  const { error } = await supabase.from("feed_media_series").delete().eq("id", parseInt(id, 10));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
