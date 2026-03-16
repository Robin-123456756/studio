import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/feed-media/versions?id=N — list versions for a feed item */
export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const supabase = getSupabaseServerOrThrow();
  const { data, error } = await supabase
    .from("feed_media_versions")
    .select("id, feed_media_id, title, category, layout, created_at, edited_by")
    .eq("feed_media_id", parseInt(id, 10))
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ versions: data ?? [] });
}
