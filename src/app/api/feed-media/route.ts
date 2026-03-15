import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/feed-media — public: active feed media, newest first, pinned on top */
export async function GET() {
  const supabase = getSupabaseServerOrThrow();

  const { data, error } = await supabase
    .from("feed_media")
    .select("id, title, body, image_url, category, is_pinned, gameweek_id, created_at")
    .eq("is_active", true)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ items: [] }, { status: 500 });
  }

  return NextResponse.json(
    { items: data ?? [] },
    {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
