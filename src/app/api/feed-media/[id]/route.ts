import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/feed-media/[id] — fetch a single published feed item by ID */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const itemId = parseInt(id, 10);

  if (isNaN(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const supabase = getSupabaseServerOrThrow();

  const { data, error } = await supabase
    .from("feed_media")
    .select(
      "id, title, body, image_url, video_url, thumbnail_url, category, layout, is_pinned, gameweek_id, media_urls, created_at, view_count, display_size"
    )
    .eq("id", itemId)
    .eq("is_active", true)
    .in("status", ["published"])
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(
    { item: data },
    {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}
