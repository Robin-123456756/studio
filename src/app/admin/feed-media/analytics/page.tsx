"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Eye, BarChart3, FileText, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const CAT_HEX: Record<string, string> = {
  announcement: "#F59E0B", matchday: "#3B82F6", player_spotlight: "#10B981",
  deadline: "#EF4444", general: "#8B5CF6", breaking: "#DC2626",
  transfer_news: "#7C3AED", match_report: "#0EA5E9",
};

const CAT_LABELS: Record<string, string> = {
  announcement: "Announcement", matchday: "Match Day", player_spotlight: "Player Spotlight",
  deadline: "Deadline", general: "General", breaking: "Breaking",
  transfer_news: "Transfer News", match_report: "Match Report",
};

type AnalyticsData = {
  totalViews: number;
  avgViews: number;
  postCount: number;
  viewsByCategory: Record<string, number>;
  viewsByLayout: Record<string, number>;
  headlineAnalysis: Record<string, number>;
  topPosts: { id: number; title: string; category: string; view_count: number }[];
  bestHours: { hour: number; views: number }[];
  decayingPosts: { id: number; title: string; category: string; view_count: number; daysSinceCreated: number }[];
};

export default function FeedMediaAnalyticsPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/admin/feed-media/analytics", { credentials: "same-origin" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [session]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-muted animate-pulse rounded-xl" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-4xl mx-auto text-center py-20 text-muted-foreground">
          Failed to load analytics data.
        </div>
      </div>
    );
  }

  const maxCatViews = Math.max(...Object.values(data.viewsByCategory), 1);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/feed-media" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold">Content Analytics</h1>
            <p className="text-sm text-muted-foreground">Engagement insights from your feed</p>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <Eye className="h-5 w-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{data.totalViews.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Views</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
              <p className="text-2xl font-bold">{data.avgViews}</p>
              <p className="text-xs text-muted-foreground">Avg / Post</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <FileText className="h-5 w-5 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-bold">{data.postCount}</p>
              <p className="text-xs text-muted-foreground">Total Posts</p>
            </CardContent>
          </Card>
        </div>

        {/* Views by category */}
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm">Views by Category</h2>
            </div>
            {Object.entries(data.viewsByCategory)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, views]) => (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{CAT_LABELS[cat] || cat}</span>
                    <span className="text-muted-foreground">{views.toLocaleString()}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max((views / maxCatViews) * 100, 2)}%`,
                        backgroundColor: CAT_HEX[cat] || "#8B5CF6",
                      }}
                    />
                  </div>
                </div>
              ))}
            {Object.keys(data.viewsByCategory).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No data yet</p>
            )}
          </CardContent>
        </Card>

        {/* Layout performance + Headline analysis */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-sm mb-3">Avg Views by Layout</h2>
              <div className="space-y-2">
                {Object.entries(data.viewsByLayout || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([layout, avg]) => (
                    <div key={layout} className="flex justify-between text-sm">
                      <span className="capitalize">{layout}</span>
                      <span className="font-bold">{avg}</span>
                    </div>
                  ))}
                {Object.keys(data.viewsByLayout || {}).length === 0 && (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-sm mb-3">Headline Length</h2>
              <div className="space-y-2">
                {Object.entries(data.headlineAnalysis || {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([bucket, avg]) => (
                    <div key={bucket} className="flex justify-between text-sm">
                      <span>{bucket}</span>
                      <span className="font-bold">{avg} avg</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Best time to post */}
        {(data.bestHours?.length ?? 0) > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-sm mb-3">Best Time to Post (Kampala)</h2>
              <div className="grid grid-cols-12 gap-0.5 items-end h-20">
                {Array.from({ length: 24 }, (_, h) => {
                  const entry = data.bestHours?.find((e) => e.hour === h);
                  const views = entry?.views ?? 0;
                  const maxV = Math.max(...(data.bestHours?.map((e) => e.views) ?? [1]), 1);
                  const pct = Math.max((views / maxV) * 100, 4);
                  const isTop = views === maxV && views > 0;
                  return (
                    <div key={h} className="flex flex-col items-center gap-0.5">
                      <div
                        className={`w-full rounded-t transition-all ${isTop ? "bg-green-500" : "bg-primary/40"}`}
                        style={{ height: `${pct}%` }}
                        title={`${h}:00 — ${views} views`}
                      />
                      {h % 4 === 0 && <span className="text-[8px] text-muted-foreground">{h}</span>}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Peak hour: {data.bestHours?.[0]?.hour ?? 0}:00 EAT ({data.bestHours?.[0]?.views ?? 0} views)
              </p>
            </CardContent>
          </Card>
        )}

        {/* Content going stale */}
        {(data.decayingPosts?.length ?? 0) > 0 && (
          <Card>
            <CardContent className="p-4">
              <h2 className="font-semibold text-sm mb-3">Content Going Stale</h2>
              <div className="space-y-2">
                {data.decayingPosts.map((post) => (
                  <div key={post.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{post.title}</p>
                      <p className="text-[10px] text-muted-foreground">{post.daysSinceCreated}d old, {post.view_count} views</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/30 shrink-0">
                      Stale
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top posts */}
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold text-sm mb-3">Top Posts</h2>
            <div className="space-y-2">
              {data.topPosts.map((post, i) => (
                <div key={post.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                  <span className="text-lg font-bold text-muted-foreground w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{post.title}</p>
                    <Badge
                      variant="secondary"
                      className="text-[10px] mt-0.5"
                      style={{ backgroundColor: `${CAT_HEX[post.category] || "#8B5CF6"}20`, color: CAT_HEX[post.category] }}
                    >
                      {CAT_LABELS[post.category] || post.category}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{post.view_count.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
              {data.topPosts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No posts yet</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
