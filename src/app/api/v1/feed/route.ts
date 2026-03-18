import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";
import { createHash } from "crypto";

export const dynamic = "force-dynamic";

/**
 * Public API: GET /api/v1/feed
 *
 * Token-authenticated feed endpoint for external consumers
 * (Telegram bots, mobile apps, third-party integrations).
 *
 * Query params:
 *   - page (default 1)
 *   - limit (default 20, max 50)
 *   - category (optional filter)
 *   - since (ISO date, optional)
 *
 * Auth: Bearer token → hashed and looked up in api_keys table.
 */
export async function GET(req: NextRequest) {
  // Authenticate via API key
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing API key. Use Authorization: Bearer <key>" }, { status: 401 });
  }

  const token = authHeader.slice(7).trim();
  const keyHash = createHash("sha256").update(token).digest("hex");

  const supabase = getSupabaseServerOrThrow();

  const { data: apiKey } = await supabase
    .from("api_keys")
    .select("id, name, permissions, is_active")
    .eq("key_hash", keyHash)
    .eq("is_active", true)
    .maybeSingle();

  if (!apiKey) {
    return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
  }

  // Check permission
  const perms = (apiKey.permissions as string[]) ?? [];
  if (!perms.includes("feed:read")) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Update last_used_at (fire-and-forget)
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id).then();

  // Parse query params
  const url = req.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)));
  const category = url.searchParams.get("category");
  const since = url.searchParams.get("since");
  const offset = (page - 1) * limit;

  const now = new Date().toISOString();

  // Build query — include published items and overdue scheduled items
  let query = supabase
    .from("feed_media")
    .select("id, title, body, image_url, video_url, category, layout, is_pinned, gameweek_id, structured_data, og_image_url, created_at, view_count", { count: "exact" })
    .eq("is_active", true)
    .or(`status.eq.published,and(status.eq.scheduled,publish_at.lte.${now})`);

  if (category) query = query.eq("category", category);
  if (since) query = query.gte("created_at", since);

  const { data, count, error } = await query
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = count ?? 0;

  return NextResponse.json({
    data: data ?? [],
    meta: {
      page,
      limit,
      total,
      hasMore: offset + limit < total,
    },
  }, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  });
}
