"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DOMPurify from "dompurify";
import { ArrowLeft, Calendar, Eye, Hash, Pin, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Types ─────────────────────────────────────────────────────────────── */

type FeedItem = {
  id: number;
  title: string;
  body: string | null;
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  category: string;
  layout: string;
  is_pinned: boolean;
  gameweek_id: number | null;
  media_urls: string[] | null;
  created_at: string;
  view_count: number;
  display_size: string;
};

const CAT_COLORS: Record<string, string> = {
  announcement: "bg-amber-500",
  matchday: "bg-blue-500",
  player_spotlight: "bg-emerald-500",
  deadline: "bg-red-500",
  general: "bg-violet-500",
  breaking: "bg-red-600",
  transfer_news: "bg-purple-600",
  match_report: "bg-sky-500",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Kampala",
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Kampala",
  });
}

/* ── Component ─────────────────────────────────────────────────────────── */

export default function FeedItemPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    if (!id) return;

    async function load() {
      try {
        const res = await fetch(`/api/feed-media/${id}`, { credentials: "same-origin" });
        if (res.status === 404) {
          setError("This post was not found or has been removed.");
          return;
        }
        if (!res.ok) {
          setError("Failed to load post.");
          return;
        }
        const json = await res.json();
        setItem(json.item);

        // Track view (fire-and-forget)
        fetch("/api/feed-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: json.item.id }),
        }).catch(() => {});
      } catch {
        setError("Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  /* ── Loading skeleton ───────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <Skeleton className="h-6 w-32 mb-6" />
          <Skeleton className="h-64 w-full rounded-2xl mb-6" />
          <Skeleton className="h-8 w-3/4 mb-3" />
          <Skeleton className="h-4 w-1/2 mb-6" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/6" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Error / Not Found ──────────────────────────────────────────────── */
  if (error || !item) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
        <div className="rounded-2xl border bg-card p-8 max-w-sm w-full">
          <h2 className="text-lg font-bold mb-2">Post not found</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {error || "This post doesn't exist or has been removed."}
          </p>
          <button
            onClick={() => router.back()}
            className="text-sm text-primary font-medium hover:underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  const hasVideo = !!item.video_url;
  const heroMedia = item.video_url || item.image_url;
  const isGallery = item.layout === "gallery" && item.media_urls && item.media_urls.length > 0;
  const galleryImages = item.media_urls ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl">
        {/* ── Hero media ──────────────────────────────────────────────── */}
        {heroMedia && (
          <div className="relative w-full aspect-video bg-black">
            {hasVideo ? (
              <video
                src={item.video_url!}
                controls
                playsInline
                poster={item.thumbnail_url || undefined}
                className="absolute inset-0 w-full h-full object-contain"
              />
            ) : (
              <img
                src={heroMedia}
                alt={item.title}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            {/* Back button overlay */}
            <Link
              href="/dashboard"
              className="absolute top-4 left-4 z-10 flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-white text-sm font-medium hover:bg-black/70 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </div>
        )}

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div className="px-4 py-5">
          {/* Back link (when no hero media) */}
          {!heroMedia && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          )}

          {/* Meta row: category + date + views */}
          <div className="flex items-center gap-2 flex-wrap mb-3">
            <Badge
              className={cn(
                "text-[11px] uppercase tracking-wider border-0 text-white",
                CAT_COLORS[item.category] ?? "bg-violet-500"
              )}
            >
              {item.category.replace("_", " ")}
            </Badge>
            {item.is_pinned && (
              <Badge variant="secondary" className="text-[11px] gap-0.5">
                <Pin className="h-3 w-3" />
                Pinned
              </Badge>
            )}
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDate(item.created_at)}
            </span>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatTime(item.created_at)}
            </span>
            {item.gameweek_id && (
              <span className="text-xs text-primary font-medium flex items-center gap-1">
                <Hash className="h-3 w-3" />
                GW{item.gameweek_id}
              </span>
            )}
            {(item.view_count ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                <Eye className="h-3 w-3" />
                {item.view_count} views
              </span>
            )}
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold leading-tight mb-4">
            {item.title}
          </h1>

          {/* Gallery viewer */}
          {isGallery && (
            <div className="mb-6">
              {/* Main image */}
              <div className="relative rounded-2xl overflow-hidden bg-black mb-2">
                <img
                  src={galleryImages[galleryIndex]}
                  alt={`Gallery image ${galleryIndex + 1}`}
                  className="w-full aspect-video object-contain"
                />
                <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs rounded-full px-2.5 py-1 font-medium">
                  {galleryIndex + 1} / {galleryImages.length}
                </div>
              </div>
              {/* Thumbnail strip */}
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {galleryImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIndex(i)}
                    className={cn(
                      "shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition-all",
                      i === galleryIndex
                        ? "border-primary ring-1 ring-primary/30"
                        : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Body content */}
          {item.body && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none leading-relaxed"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(item.body) }}
            />
          )}

          {/* Image below text (for feature layout with no hero video) */}
          {!heroMedia && item.image_url && (
            <div className="mt-6 rounded-2xl overflow-hidden">
              <img
                src={item.image_url}
                alt={item.title}
                className="w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
