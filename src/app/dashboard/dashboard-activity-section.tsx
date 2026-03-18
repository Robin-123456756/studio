"use client";

import DOMPurify from "dompurify";
import Image from "next/image";
import Link from "next/link";
import { Clock, Newspaper, Repeat2, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { CategoryPill, timeAgo } from "./dashboard-ui";
import type {
  ApiMatch,
  DeadlineCountdown,
  FeedMediaItem,
  GWInfo,
  Row,
  TransferActivityItem,
} from "./dashboard-types";

type DashboardActivitySectionProps = {
  changedIds: Set<string>;
  deadlineCountdown: DeadlineCountdown;
  deadlineGameweek: GWInfo | null;
  feedMedia: FeedMediaItem[];
  loading: boolean;
  recentMatches: ApiMatch[];
  table: Row[];
  transfers: TransferActivityItem[];
};

function sanitizedHtml(html: string) {
  return { __html: DOMPurify.sanitize(html) };
}

export function DashboardActivitySection({
  changedIds,
  deadlineCountdown,
  deadlineGameweek,
  feedMedia,
  loading,
  recentMatches,
  table,
  transfers,
}: DashboardActivitySectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="flex items-center gap-2 text-base font-headline font-semibold">
          <Newspaper className="h-4 w-4" /> Latest
        </h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-[180px] w-full rounded-2xl animate-pulse bg-muted" />
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 w-full rounded-2xl animate-pulse bg-muted" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            const pinned = feedMedia.find((item) => item.is_pinned);
            if (!pinned) return null;
            const hasVideo = !!pinned.video_url;
            const mediaUrl = pinned.video_url || pinned.image_url;

            return (
              <Link href={`/dashboard/feed/${pinned.id}`} className="block">
                <div
                  className="relative rounded-2xl overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all"
                  style={{ minHeight: 180 }}
                >
                  {hasVideo ? (
                    <video
                      src={pinned.video_url ?? undefined}
                      muted
                      loop
                      autoPlay
                      playsInline
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : mediaUrl ? (
                    <img src={mediaUrl} alt={pinned.title} className="absolute inset-0 w-full h-full object-cover" />
                  ) : null}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  <div className="relative flex flex-col justify-end p-4" style={{ minHeight: 180 }}>
                    <div className="flex items-center gap-2 mb-1">
                      <CategoryPill category={pinned.category} />
                      <span className="text-[10px] text-white/50">{timeAgo(pinned.created_at)}</span>
                      {hasVideo && (
                        <span className="text-[10px] text-white/50 bg-white/20 px-1.5 rounded">VIDEO</span>
                      )}
                    </div>
                    <div className="text-white font-bold text-[15px] leading-tight">{pinned.title}</div>
                    {pinned.body && (
                      <div
                        className="text-white/70 text-xs mt-1 line-clamp-2"
                        dangerouslySetInnerHTML={sanitizedHtml(pinned.body)}
                      />
                    )}
                  </div>
                </div>
              </Link>
            );
          })()}

          {recentMatches.slice(0, 3).map((match) => (
            <Link
              key={match.id}
              href={`/match/${match.id}`}
              className="block rounded-2xl border bg-card p-3 shadow-[var(--shadow-1)] hover:bg-accent transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <CategoryPill category="result" />
                <span className="text-[10px] text-muted-foreground">
                  {match.kickoff_time ? timeAgo(match.kickoff_time) : ""}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {match.home_team?.logo_url && (
                    <Image
                      src={match.home_team.logo_url}
                      alt={match.home_team.short_name}
                      width={24}
                      height={24}
                      className="rounded-full shrink-0"
                    />
                  )}
                  <span className="text-sm font-medium truncate">{match.home_team?.short_name ?? "--"}</span>
                </div>
                <div
                  className={cn(
                    "shrink-0 rounded-lg bg-foreground/5 px-3 py-1 text-base font-bold font-mono tabular-nums",
                    changedIds.has(match.id) && "text-emerald-500 animate-pulse"
                  )}
                >
                  {match.home_goals ?? "-"} - {match.away_goals ?? "-"}
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                  <span className="text-sm font-medium truncate text-right">
                    {match.away_team?.short_name ?? "--"}
                  </span>
                  {match.away_team?.logo_url && (
                    <Image
                      src={match.away_team.logo_url}
                      alt={match.away_team.short_name}
                      width={24}
                      height={24}
                      className="rounded-full shrink-0"
                    />
                  )}
                </div>
              </div>
              {(match.home_events?.some((event) => event.goals > 0) ||
                match.away_events?.some((event) => event.goals > 0)) && (
                <div className="mt-2 pt-2 border-t text-[11px] text-muted-foreground truncate">
                  {[
                    ...(match.home_events?.filter((event) => event.goals > 0).map((event) =>
                      `${event.playerName}${event.goals > 1 ? ` (${event.goals})` : ""}`
                    ) ?? []),
                    ...(match.away_events?.filter((event) => event.goals > 0).map((event) =>
                      `${event.playerName}${event.goals > 1 ? ` (${event.goals})` : ""}`
                    ) ?? []),
                  ].join(", ")}
                </div>
              )}
            </Link>
          ))}

          {transfers.slice(0, 3).map((transfer, index) => (
            <div
              key={`tx-${transfer.id ?? index}`}
              className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-[var(--shadow-1)]"
            >
              <Repeat2 className="h-4 w-4 text-purple-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm truncate">
                  <span className="font-medium">{transfer.managerTeam ?? "A manager"}</span>
                  {" signed "}
                  <span className="font-semibold">
                    {transfer.playerIn?.webName ?? transfer.playerIn?.name ?? "--"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CategoryPill category="transfer" />
                {transfer.createdAt && (
                  <span className="text-[10px] text-muted-foreground">{timeAgo(transfer.createdAt)}</span>
                )}
              </div>
            </div>
          ))}

          {feedMedia
            .filter((item) => !item.is_pinned)
            .slice(0, 8)
            .map((item) => {
              const layout = item.layout || "hero";
              const thumbUrl = item.thumbnail_url || item.image_url;
              const hasVideo = !!item.video_url;
              const isGallery = layout === "gallery" && item.media_urls && item.media_urls.length > 0;
              const isQuick = layout === "quick";
              const size = item.display_size || "standard";
              const isFeatured = size === "featured";

              if (isFeatured) {
                const heroImg = item.video_url || thumbUrl;
                return (
                  <Link key={`media-${item.id}`} href={`/dashboard/feed/${item.id}`} className="block">
                    <div
                      className="relative rounded-2xl overflow-hidden hover:ring-2 hover:ring-primary/30 transition-all"
                      style={{ minHeight: 200 }}
                    >
                      {hasVideo ? (
                        <video
                          src={item.video_url ?? undefined}
                          muted
                          loop
                          autoPlay
                          playsInline
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : heroImg ? (
                        <img src={heroImg} alt={item.title} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-purple-800" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                      <div className="relative flex flex-col justify-end p-4" style={{ minHeight: 200 }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <CategoryPill category={item.category} />
                          <span className="text-[10px] text-white/50">{timeAgo(item.created_at)}</span>
                          {hasVideo && (
                            <span className="text-[10px] text-white/50 bg-white/20 px-1.5 rounded">VIDEO</span>
                          )}
                        </div>
                        <div className="text-white font-bold text-lg leading-tight">{item.title}</div>
                        {item.body && (
                          <div
                            className="text-white/70 text-xs mt-1.5 line-clamp-2"
                            dangerouslySetInnerHTML={sanitizedHtml(item.body)}
                          />
                        )}
                      </div>
                    </div>
                  </Link>
                );
              }

              if (isQuick) {
                return (
                  <Link key={`media-${item.id}`} href={`/dashboard/feed/${item.id}`} className="block">
                    <div className="rounded-2xl border-l-4 border-purple-500 bg-card p-3 shadow-[var(--shadow-1)] hover:bg-accent transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryPill category={item.category} />
                        <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                      </div>
                      <div className="text-sm font-semibold leading-tight">{item.title}</div>
                      {item.body && size !== "compact" && (
                        <div
                          className="text-xs text-muted-foreground mt-1 line-clamp-2"
                          dangerouslySetInnerHTML={sanitizedHtml(item.body)}
                        />
                      )}
                    </div>
                  </Link>
                );
              }

              if (layout === "split") {
                return (
                  <Link key={`media-${item.id}`} href={`/dashboard/feed/${item.id}`} className="block">
                    <div className="flex rounded-2xl border bg-card overflow-hidden shadow-[var(--shadow-1)] hover:bg-accent transition-colors">
                      {thumbUrl && (
                        <div className="w-2/5 shrink-0 relative">
                          <img src={thumbUrl} alt={item.title} className="w-full h-full min-h-[100px] object-cover" />
                          {hasVideo && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                                <div className="w-0 h-0 border-l-[10px] border-l-white border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent ml-0.5" />
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex-1 p-3 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                          <CategoryPill category={item.category} />
                          <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                        </div>
                        <div className="text-sm font-semibold leading-tight line-clamp-2">{item.title}</div>
                        {item.body && size !== "compact" && (
                          <div
                            className="text-xs text-muted-foreground mt-1 line-clamp-2"
                            dangerouslySetInnerHTML={sanitizedHtml(item.body)}
                          />
                        )}
                      </div>
                    </div>
                  </Link>
                );
              }

              if (layout === "feature") {
                return (
                  <Link key={`media-${item.id}`} href={`/dashboard/feed/${item.id}`} className="block">
                    <div className="rounded-2xl border bg-card overflow-hidden shadow-[var(--shadow-1)] hover:bg-accent transition-colors">
                      <div className="p-3 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <CategoryPill category={item.category} />
                          <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                        </div>
                        <div className="text-base font-bold leading-tight">{item.title}</div>
                        {item.body && size !== "compact" && (
                          <div
                            className="text-xs text-muted-foreground mt-1 line-clamp-2"
                            dangerouslySetInnerHTML={sanitizedHtml(item.body)}
                          />
                        )}
                      </div>
                      {thumbUrl && <img src={thumbUrl} alt={item.title} className="w-full h-32 object-cover" />}
                    </div>
                  </Link>
                );
              }

              if (isGallery) {
                const images = item.media_urls!;
                return (
                  <Link key={`media-${item.id}`} href={`/dashboard/feed/${item.id}`} className="block">
                    <div className="rounded-2xl border bg-card overflow-hidden shadow-[var(--shadow-1)] hover:bg-accent transition-colors">
                      <div className="p-3 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <CategoryPill category={item.category} />
                          <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                        </div>
                        <div className="text-sm font-semibold leading-tight">{item.title}</div>
                      </div>
                      <div className="flex gap-0.5 px-0.5 pb-0.5">
                        {images.slice(0, 3).map((url, index) => (
                          <div key={index} className="flex-1 relative">
                            <img src={url} alt="" className="w-full h-20 object-cover" />
                            {index === 2 && images.length > 3 && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">+{images.length - 3}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Link>
                );
              }

              const thumbSize = size === "compact" ? "h-14 w-14" : "h-20 w-20";
              return (
                <Link key={`media-${item.id}`} href={`/dashboard/feed/${item.id}`} className="block">
                  <div className="flex gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-1)] hover:bg-accent transition-colors">
                    {thumbUrl ? (
                      <div className="relative shrink-0">
                        <img src={thumbUrl} alt={item.title} className={cn(thumbSize, "rounded-xl object-cover")} />
                        {hasVideo && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                              <div className="w-0 h-0 border-l-[8px] border-l-white border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent ml-0.5" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={cn(thumbSize, "rounded-xl bg-muted shrink-0 flex items-center justify-center")}>
                        <span className="text-xs text-muted-foreground">No img</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryPill category={item.category} />
                        <span className="text-[10px] text-muted-foreground">{timeAgo(item.created_at)}</span>
                      </div>
                      <div className="text-sm font-semibold leading-tight line-clamp-2">{item.title}</div>
                      {item.body && size !== "compact" && (
                        <div
                          className="text-xs text-muted-foreground mt-0.5 line-clamp-1"
                          dangerouslySetInnerHTML={sanitizedHtml(item.body)}
                        />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}

          {deadlineCountdown.tone !== "neutral" && deadlineCountdown.tone !== "closed" && (
            <Link
              href="/dashboard/fantasy"
              className={cn(
                "flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors",
                deadlineCountdown.tone === "critical"
                  ? "bg-red-500/10 border border-red-500/20"
                  : deadlineCountdown.tone === "urgent"
                    ? "bg-orange-500/10 border border-orange-500/20"
                    : "bg-amber-500/10 border border-amber-500/20"
              )}
            >
              <Clock
                className={cn(
                  "h-5 w-5 shrink-0",
                  deadlineCountdown.tone === "critical"
                    ? "text-red-500"
                    : deadlineCountdown.tone === "urgent"
                      ? "text-orange-500"
                      : "text-amber-500"
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">
                  GW {deadlineGameweek?.id} deadline in {deadlineCountdown.label}
                </div>
                <div className="text-xs text-muted-foreground">Make your transfers before it closes</div>
              </div>
              <CategoryPill category="deadline" />
            </Link>
          )}

          {table.length > 0 && (
            <Link
              href="/dashboard/matches?tab=table"
              className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-[var(--shadow-1)] hover:bg-accent transition-colors"
            >
              <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">League leader: {table[0].name}</div>
                <div className="text-xs text-muted-foreground">
                  {table[0].Pts} pts · {table[0].W}W {table[0].D}D {table[0].L}L
                </div>
              </div>
              <CategoryPill category="leader" />
            </Link>
          )}

          {recentMatches.length === 0 &&
            transfers.length === 0 &&
            table.length === 0 &&
            feedMedia.length === 0 && (
              <div className="rounded-2xl border bg-card py-8 text-center text-sm text-muted-foreground">
                No updates yet - check back once matches begin.
              </div>
            )}
        </div>
      )}
    </div>
  );
}
