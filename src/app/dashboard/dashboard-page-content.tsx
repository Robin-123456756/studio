"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Crown, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardActivitySection } from "./dashboard-activity-section";
import { DashboardTableSection } from "./dashboard-table-section";
import { formatKickoff, formatShortDate, useDeadlineCountdown } from "./dashboard-ui";
import { useDashboardData } from "./use-dashboard-data";

export default function DashboardPageContent() {
  const [expanded, setExpanded] = React.useState(false);
  const {
    table,
    recentMatches,
    transfers,
    feedMedia,
    topPerformer,
    upcomingMatches,
    topLady,
    loading,
    resultIdx,
    fixtureIdx,
    currentGW,
    nextGW,
    fantasyStats,
    fantasyLoading,
    isLoggedIn,
    changedIds,
    lastUpdated,
    ago,
  } = useDashboardData();

  const latestResult = recentMatches[resultIdx] ?? null;
  const nextFixture = upcomingMatches[fixtureIdx] ?? null;
  const hasLiveMatch = recentMatches.some((match) => match.is_played && !match.is_final);
  const deadlineGameweek = currentGW ?? nextGW ?? null;
  const deadlineCountdown = useDeadlineCountdown(deadlineGameweek?.deadline_time);
  const deadlinePillClass =
    deadlineCountdown.tone === "critical"
      ? "bg-red-500/15 text-red-600"
      : deadlineCountdown.tone === "urgent"
        ? "bg-orange-500/15 text-orange-600"
        : deadlineCountdown.tone === "soon"
          ? "bg-amber-500/15 text-amber-700"
          : deadlineCountdown.tone === "normal"
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-muted text-muted-foreground";

  const staggerStyle = { animationFillMode: "both" as const };

  return (
    <div className="space-y-4 animate-in fade-in-50">
      <section className={cn("animate-slide-up animate-stagger-1")} style={staggerStyle}>
        <div className="flex items-center gap-3 pt-2 bg-background">
          <Image
            src="/tbl-logo.png"
            alt="The Budo League"
            width={140}
            height={65}
            className="h-auto w-[120px] object-contain shrink-0 mix-blend-multiply dark:invert dark:mix-blend-screen"
            priority
          />
          <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="inline-block rounded-full bg-foreground/10 px-3 py-0.5 text-[10px] font-bold tracking-widest text-foreground/70 uppercase">
                Season 9
              </span>
              {currentGW && (
                <span className="text-[11px] font-semibold text-foreground/80">GW {currentGW.id}</span>
              )}
              {hasLiveMatch && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  LIVE
                </span>
              )}
            </div>
            {deadlineCountdown.tone !== "neutral" && (
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                  deadlinePillClass
                )}
              >
                {deadlineCountdown.tone === "closed"
                  ? `GW ${deadlineGameweek?.id ?? "--"} deadline closed`
                  : `GW ${deadlineGameweek?.id ?? "--"} deadline: ${deadlineCountdown.label}`}
              </span>
            )}
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground/70">Updated {ago}</span>
            )}
          </div>
        </div>
      </section>

      <section className={cn("animate-slide-up animate-stagger-2")} style={staggerStyle}>
        <Link href="/dashboard/fantasy" className="block" aria-label="Fantasy football — view your team, points, and league standings">
          <div className="rounded-2xl bg-gradient-to-br from-[#37003C] via-[#4a0050] to-[#1a0025] p-5 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -right-4 -bottom-6 h-20 w-20 rounded-full bg-white/5 pointer-events-none" />
            <div className="relative">
              {fantasyLoading ? (
                <div className="flex items-center justify-around gap-4">
                  {[0, 1, 2].map((index) => (
                    <div key={index} className="flex flex-col items-center gap-1.5">
                      <Skeleton className="h-8 w-14 rounded bg-white/10" />
                      <Skeleton className="h-3 w-14 rounded bg-white/10" />
                    </div>
                  ))}
                </div>
              ) : isLoggedIn && fantasyStats ? (
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-3">
                    {fantasyStats.teamName} · Fantasy
                  </div>
                  <div className="flex items-end justify-around gap-4">
                    <div className="flex flex-col items-center">
                      <span className="text-4xl font-black tabular-nums text-white leading-none">
                        {fantasyStats.gwPoints ?? "--"}
                      </span>
                      <span className="text-[10px] text-white/60 font-medium mt-1">GW pts</span>
                    </div>
                    <div className="h-10 w-px bg-white/20" />
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-2xl font-bold tabular-nums text-white leading-none">
                          {fantasyStats.rank ?? "--"}
                        </span>
                      </div>
                      <span className="text-[10px] text-white/60 font-medium mt-1">Rank</span>
                    </div>
                    <div className="h-10 w-px bg-white/20" />
                    <div className="flex flex-col items-center">
                      <span className="text-2xl font-bold tabular-nums text-white/80 leading-none">
                        {fantasyStats.totalPoints}
                      </span>
                      <span className="text-[10px] text-white/60 font-medium mt-1">Total pts</span>
                    </div>
                  </div>
                </div>
              ) : isLoggedIn ? (
                <div className="text-center py-1">
                  <div className="text-white/60 text-xs uppercase tracking-wider mb-1">Your Fantasy</div>
                  <div className="text-white font-semibold">No scores yet - pick your team →</div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1.5">Budo League Fantasy</div>
                  <div className="text-white font-bold text-base">Sign in to join the fantasy →</div>
                </div>
              )}
            </div>
          </div>
        </Link>
      </section>

      <section className={cn("animate-slide-up animate-stagger-2")} style={staggerStyle}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border bg-card p-3 shadow-[var(--shadow-1)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Result</span>
              {recentMatches.length > 1 && (
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {resultIdx + 1}/{recentMatches.length}
                </span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-6 w-14 rounded mx-auto" />
              </div>
            ) : latestResult ? (
              <div className="flex flex-col items-center gap-1">
                <div className="text-[10px] text-muted-foreground">{formatShortDate(latestResult.kickoff_time)}</div>
                <div className="flex items-center gap-1.5 justify-center w-full">
                  <img
                    src={latestResult.home_team?.logo_url ?? "/placeholder-team.png"}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover shrink-0"
                  />
                  <span className="text-[11px] font-medium leading-tight truncate">
                    {latestResult.home_team?.short_name ?? "--"}
                  </span>
                </div>
                <div
                  className={cn(
                    "text-xl font-black font-mono tabular-nums",
                    changedIds.has(latestResult.id) && "text-emerald-500 animate-pulse"
                  )}
                >
                  {latestResult.home_goals ?? "-"} - {latestResult.away_goals ?? "-"}
                </div>
                <div className="flex items-center gap-1.5 justify-center w-full">
                  <img
                    src={latestResult.away_team?.logo_url ?? "/placeholder-team.png"}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover shrink-0"
                  />
                  <span className="text-[11px] font-medium leading-tight truncate">
                    {latestResult.away_team?.short_name ?? "--"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground text-center py-3">No results yet</div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-3 shadow-[var(--shadow-1)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next Up</span>
              {upcomingMatches.length > 1 && (
                <span className="text-[9px] text-muted-foreground tabular-nums">
                  {fixtureIdx + 1}/{upcomingMatches.length}
                </span>
              )}
            </div>
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-4 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            ) : nextFixture ? (
              <div className="space-y-1.5">
                <div className="text-[10px] text-muted-foreground">{formatShortDate(nextFixture.kickoff_time)}</div>
                <div className="flex items-center gap-1.5">
                  <img
                    src={nextFixture.home_team?.logo_url ?? "/placeholder-team.png"}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover shrink-0"
                  />
                  <span className="text-[11px] font-semibold leading-tight truncate">
                    {nextFixture.home_team?.short_name ?? "--"}
                  </span>
                </div>
                <div className="text-[10px] font-medium text-muted-foreground text-center">vs</div>
                <div className="flex items-center gap-1.5">
                  <img
                    src={nextFixture.away_team?.logo_url ?? "/placeholder-team.png"}
                    alt=""
                    className="h-5 w-5 rounded-full object-cover shrink-0"
                  />
                  <span className="text-[11px] font-semibold leading-tight truncate">
                    {nextFixture.away_team?.short_name ?? "--"}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">{formatKickoff(nextFixture.kickoff_time)}</div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground text-center py-3">No fixtures yet</div>
            )}
          </div>
        </div>
      </section>

      <section className={cn("animate-slide-up animate-stagger-3")} style={staggerStyle}>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-pink-200/40 dark:border-pink-500/20 bg-card p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Crown className="h-3.5 w-3.5 text-pink-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Lady</span>
            </div>
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-3 w-full rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
              </div>
            ) : topLady ? (
              <Link href={`/dashboard/players/${topLady.playerId}`} className="block">
                <div className="flex flex-col items-center text-center gap-1.5">
                  <div className="relative">
                    {topLady.avatarUrl ? (
                      <img
                        src={topLady.avatarUrl}
                        alt={topLady.name}
                        className="h-10 w-10 rounded-xl object-cover border-2 border-pink-300/50"
                      />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-900/40 dark:to-pink-800/30 border-2 border-pink-300/50 flex items-center justify-center">
                        <span className="text-sm font-bold text-pink-500/70">{topLady.name.charAt(0)}</span>
                      </div>
                    )}
                    <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-pink-500 flex items-center justify-center">
                      <Crown className="h-2.5 w-2.5 text-white" />
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold leading-tight truncate w-full">{topLady.name}</div>
                  <div className="text-[10px] text-muted-foreground truncate w-full">{topLady.teamName}</div>
                  <div className="text-sm font-bold text-pink-600 dark:text-pink-400 tabular-nums">
                    {topLady.points} pts
                  </div>
                </div>
              </Link>
            ) : (
              <div className="text-[11px] text-muted-foreground text-center py-3">Pending</div>
            )}
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-3 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_30%,white_0%,transparent_60%)] pointer-events-none" />
            <div className="relative">
              <div className="flex items-center gap-1.5 mb-2">
                <Zap className="h-3.5 w-3.5 text-white/80" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">GW Best</span>
              </div>
              {loading ? (
                <div className="flex flex-col items-center gap-2">
                  <Skeleton className="h-10 w-10 rounded-xl bg-white/20" />
                  <Skeleton className="h-3 w-full rounded bg-white/20" />
                  <Skeleton className="h-3 w-3/4 rounded bg-white/20" />
                </div>
              ) : topPerformer ? (
                <Link href={`/dashboard/players/${topPerformer.playerId}`} className="block">
                  <div className="flex flex-col items-center text-center gap-1.5">
                    <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center">
                      <span className="text-sm font-bold text-white/90">{topPerformer.name.charAt(0)}</span>
                    </div>
                    <div className="text-[11px] font-semibold text-white leading-tight truncate w-full">
                      {topPerformer.name}
                    </div>
                    <div className="text-[10px] text-white/60 truncate w-full">{topPerformer.teamName}</div>
                    <div className="text-sm font-bold text-white tabular-nums">{topPerformer.points} pts</div>
                  </div>
                </Link>
              ) : (
                <div className="text-[11px] text-white/60 text-center py-3">Pending</div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className={cn("animate-slide-up animate-stagger-3")} style={staggerStyle}>
        <DashboardTableSection
          expanded={expanded}
          loading={loading}
          onToggleExpanded={() => setExpanded((value) => !value)}
          table={table}
        />
      </section>

      <section className={cn("animate-slide-up animate-stagger-4")} style={staggerStyle}>
        <DashboardActivitySection
          changedIds={changedIds}
          deadlineCountdown={deadlineCountdown}
          deadlineGameweek={deadlineGameweek}
          feedMedia={feedMedia}
          loading={loading}
          recentMatches={recentMatches}
          table={table}
          transfers={transfers}
        />
      </section>

      <section className={cn("animate-slide-up animate-stagger-4")} style={staggerStyle}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Link
            href="/dashboard/more/tbl-rules"
            className="btn-red-border flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-card text-foreground active:bg-[#C8102E] active:text-white transition-colors duration-150"
          >
            TBL fantasy rules
          </Link>
          <Link
            href="/dashboard/fantasy"
            className="btn-red-border flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-card text-foreground active:bg-[#C8102E] active:text-white transition-colors duration-150"
          >
            Open fantasy
          </Link>
          <Link
            href="/dashboard/explore"
            className="btn-red-border flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-card text-foreground active:bg-[#C8102E] active:text-white transition-colors duration-150"
          >
            Explore teams
          </Link>
          <Link
            href="/dashboard/matches"
            className="btn-red-border flex items-center justify-center px-4 py-2.5 text-sm font-semibold bg-card text-foreground active:bg-[#C8102E] active:text-white transition-colors duration-150"
          >
            Go to matches
          </Link>
        </div>
      </section>
    </div>
  );
}
