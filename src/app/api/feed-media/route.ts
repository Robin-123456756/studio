import { NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { rateLimitResponse, RATE_LIMIT_STANDARD } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/feed-media — public: active + published feed media, newest first, pinned on top */
export async function GET() {
  const supabase = getSupabaseServerOrThrow();

  const now = new Date().toISOString();

  // Fetch published items + scheduled items whose publish_at has passed
  const { data, error } = await supabase
    .from("feed_media")
    .select(
      "id, title, body, image_url, video_url, thumbnail_url, category, layout, is_pinned, gameweek_id, media_urls, created_at, view_count, display_size"
    )
    .eq("is_active", true)
    .in("status", ["published"])
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) {
    return NextResponse.json({ items: [] }, { status: 500 });
  }

  // Also fetch scheduled items that should now be live
  const { data: scheduled } = await supabase
    .from("feed_media")
    .select(
      "id, title, body, image_url, video_url, thumbnail_url, category, layout, is_pinned, gameweek_id, media_urls, created_at, view_count, display_size"
    )
    .eq("is_active", true)
    .eq("status", "scheduled")
    .lte("publish_at", now)
    .order("created_at", { ascending: false })
    .limit(10);

  // Auto-publish scheduled items that are past their publish_at
  if (scheduled && scheduled.length > 0) {
    const ids = scheduled.map((s) => s.id);
    await supabase
      .from("feed_media")
      .update({ status: "published" })
      .in("id", ids);
  }

  const allItems = [...(data ?? []), ...(scheduled ?? [])];
  // De-duplicate and sort: pinned first, then by created_at desc
  const seen = new Set<number>();
  const unique = allItems.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  unique.sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return NextResponse.json(
    { items: unique.slice(0, 30) },
    {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
      },
    }
  );
}

/** POST /api/feed-media — track a view (analytics, rate-limited) */
export async function POST(req: Request) {
  try {
    // Rate limit by IP to prevent view count inflation
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const rl = rateLimitResponse("feed-view", ip, RATE_LIMIT_STANDARD);
    if (rl) return rl;

    const { id } = await req.json();
    if (!id || typeof id !== "number") return NextResponse.json({ error: "Missing or invalid id" }, { status: 400 });

    const supabase = getSupabaseServerOrThrow();

    // Increment view count via RPC (atomic increment)
    await supabase.rpc("increment_feed_view_count", { item_id: id });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
