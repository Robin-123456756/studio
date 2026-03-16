import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/admin-auth";
import { getSupabaseServerOrThrow } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/feed-media/analytics — engagement stats from view_count */
export async function GET() {
  const { error: authErr } = await requireAdminSession();
  if (authErr) return authErr;

  const supabase = getSupabaseServerOrThrow();

  const { data: items, error } = await supabase
    .from("feed_media")
    .select("id, title, category, layout, view_count, status, created_at")
    .eq("is_active", true)
    .order("view_count", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const posts = items ?? [];
  const totalViews = posts.reduce((sum, p) => sum + (p.view_count ?? 0), 0);
  const postCount = posts.length;
  const avgViews = postCount > 0 ? Math.round(totalViews / postCount) : 0;

  // Views by category
  const viewsByCategory: Record<string, number> = {};
  for (const p of posts) {
    const cat = p.category || "general";
    viewsByCategory[cat] = (viewsByCategory[cat] ?? 0) + (p.view_count ?? 0);
  }

  // Top 5 posts
  const topPosts = posts.slice(0, 5).map((p) => ({
    id: p.id,
    title: p.title,
    category: p.category,
    view_count: p.view_count ?? 0,
  }));

  // Views by layout
  const layoutStats: Record<string, { views: number; count: number }> = {};
  for (const p of posts) {
    const lay = p.layout || "hero";
    if (!layoutStats[lay]) layoutStats[lay] = { views: 0, count: 0 };
    layoutStats[lay].views += p.view_count ?? 0;
    layoutStats[lay].count++;
  }
  const viewsByLayout: Record<string, number> = {};
  for (const [lay, s] of Object.entries(layoutStats)) {
    viewsByLayout[lay] = s.count > 0 ? Math.round(s.views / s.count) : 0;
  }

  // Headline length correlation
  const buckets: Record<string, { views: number; count: number }> = {
    "Short (<40)": { views: 0, count: 0 },
    "Medium (40-80)": { views: 0, count: 0 },
    "Long (>80)": { views: 0, count: 0 },
  };
  for (const p of posts) {
    const len = (p.title || "").length;
    const bucket = len < 40 ? "Short (<40)" : len <= 80 ? "Medium (40-80)" : "Long (>80)";
    buckets[bucket].views += p.view_count ?? 0;
    buckets[bucket].count++;
  }
  const headlineAnalysis: Record<string, number> = {};
  for (const [bucket, s] of Object.entries(buckets)) {
    headlineAnalysis[bucket] = s.count > 0 ? Math.round(s.views / s.count) : 0;
  }

  // Best time to post (views by hour, Africa/Kampala = UTC+3)
  const { data: hourlyViews } = await supabase.rpc("get_hourly_view_distribution").select();
  let bestHours: { hour: number; views: number }[] = [];
  if (hourlyViews && Array.isArray(hourlyViews)) {
    bestHours = (hourlyViews as any[])
      .map((r) => ({ hour: Number(r.hour), views: Number(r.views) }))
      .sort((a, b) => b.views - a.views);
  } else {
    // Fallback: query directly if RPC doesn't exist
    const { data: rawViews } = await supabase
      .from("feed_media_views")
      .select("viewed_at");
    if (rawViews) {
      const hourCounts: Record<number, number> = {};
      for (const v of rawViews) {
        const h = (new Date(v.viewed_at).getUTCHours() + 3) % 24; // UTC+3 for Kampala
        hourCounts[h] = (hourCounts[h] ?? 0) + 1;
      }
      bestHours = Object.entries(hourCounts)
        .map(([h, c]) => ({ hour: Number(h), views: c }))
        .sort((a, b) => b.views - a.views);
    }
  }

  // Content decay: posts where recent views < 20% of peak (only posts older than 7 days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const oldPosts = posts.filter((p) => p.created_at < sevenDaysAgo && (p.view_count ?? 0) > 0);
  const decayingPosts: { id: number; title: string; category: string; view_count: number; daysSinceCreated: number }[] = [];
  for (const p of oldPosts.slice(0, 20)) {
    const daysSince = Math.floor((Date.now() - new Date(p.created_at).getTime()) / (1000 * 60 * 60 * 24));
    // Simple heuristic: old posts with very low views relative to top post
    const topViews = posts[0]?.view_count ?? 1;
    if ((p.view_count ?? 0) < topViews * 0.2) {
      decayingPosts.push({
        id: p.id,
        title: p.title,
        category: p.category,
        view_count: p.view_count ?? 0,
        daysSinceCreated: daysSince,
      });
    }
  }

  return NextResponse.json({
    totalViews,
    avgViews,
    postCount,
    viewsByCategory,
    viewsByLayout,
    headlineAnalysis,
    topPosts,
    bestHours,
    decayingPosts,
  });
}
