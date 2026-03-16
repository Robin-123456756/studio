import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, SUPER_ADMIN_ONLY } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET — list all templates */
export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();
  const { data, error } = await supabase
    .from("feed_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data ?? [] });
}

/** POST — create a new template */
export async function POST(req: NextRequest) {
  const { session, error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const body = await req.json();
  const { name, title, body: templateBody, category, layout } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Template name is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerOrThrow();

  // Resolve admin ID
  const adminUsername = session?.user?.name || (session?.user as any)?.userId;
  let createdBy: number | null = null;
  if (adminUsername) {
    const { data } = await supabase
      .from("admin_users")
      .select("id")
      .eq("username", adminUsername)
      .single();
    createdBy = data?.id ?? null;
  }

  const { data: template, error } = await supabase
    .from("feed_templates")
    .insert({
      name: name.trim(),
      title: title || "",
      body: templateBody || null,
      category: category || "general",
      layout: layout || "hero",
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template }, { status: 201 });
}

/** DELETE — remove a template by id (query param) */
export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireAdminSession(SUPER_ADMIN_ONLY);
  if (authErr) return authErr;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Template ID required." }, { status: 400 });
  }

  const supabase = getSupabaseServerOrThrow();
  const { error } = await supabase
    .from("feed_templates")
    .delete()
    .eq("id", parseInt(id, 10));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
