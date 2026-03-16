"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import DOMPurify from "dompurify";
import { Clock, Crown, Newspaper, Repeat2, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

// ---------- Types ----------
type Row = {
  teamId: string;
  name: string;
  logoUrl: string;
  PL: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  LP: number;
  Pts: number;
};

type MatchEvent = {
  playerName: string;
  playerId: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  isLady: boolean;
};

type ApiMatch = {
  id: string;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean | null;
  is_final: boolean | null;
  home_team_uuid: string;
  away_team_uuid: string;
  home_team: { team_uuid: string; name: string; short_name: string; logo_url: string | null } | null;
  away_team: { team_uuid: string; name: string; short_name: string; logo_url: string | null } | null;
  home_events?: MatchEvent[];
  away_events?: MatchEvent[];
};

type ApiTeam = {
  team_uuid: string;
  name: string;
  short_name: string;
  logo_url: string | null;
};

// ---------- UI helpers ----------
function posBarClass(pos: number) {
  if (pos >= 1 && pos <= 4) return "bg-emerald-500";   // Main Cup
  if (pos >= 5 && pos <= 8) return "bg-amber-500";     // Semivule Cup
  return "bg-transparent";
}

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatKickoff(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  })
    .format(d)
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

// ---------- Feed helpers ----------
function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const CATEGORY_STYLES: Record<string, string> = {
  announcement: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  matchday: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  player_spotlight: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  deadline: "bg-red-500/15 text-red-600 dark:text-red-400",
  general: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  result: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  transfer: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  leader: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function CategoryPill({ category }: { category: string }) {
  const label = category.replace("_", " ");
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        CATEGORY_STYLES[category] ?? CATEGORY_STYLES.general
      )}
    >
      {label}
    </span>
  );
}

// ---------- Countdown helpers (from fantasy/page.tsx) ----------
function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function useDeadlineCountdown(deadlineIso?: string | null) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!deadlineIso) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadlineIso]);

  if (!deadlineIso) {
    return { label: "TBA", msLeft: null, tone: "neutral" as const };
  }

  const msLeft = new Date(deadlineIso).getTime() - now;
  if (Number.isNaN(msLeft)) {
    return { label: "TBA", msLeft: null, tone: "neutral" as const };
  }

  if (msLeft <= 0) {
    return { label: "Closed", msLeft: 0, tone: "closed" as const };
  }

  const hoursLeft = msLeft / 3600000;
  const tone =
    hoursLeft <= 1 ? "critical" : hoursLeft <= 6 ? "urgent" : hoursLeft <= 24 ? "soon" : "normal";

  return { label: formatCountdown(msLeft), msLeft, tone };
}

type GWInfo = { id: number; name?: string | null; deadline_time?: string | null };

type FeedMediaItem = {
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
};

// ---------- Fantasy stats type ----------
type FantasyQuickStats = {
  rank: number | null;
  totalPoints: number;
  gwPoints: number | null;
  teamName: string;
} | null;

export default function DashboardPage() {
  const [expanded, setExpanded] = React.useState(false);

  // Live data state
  const [teams, setTeams] = React.useState<ApiTeam[]>([]);
  const [table, setTable] = React.useState<Row[]>([]);
  const [recentMatches, setRecentMatches] = React.useState<ApiMatch[]>([]);
  const [transfers, setTransfers] = React.useState<any[]>([]);
  const [feedMedia, setFeedMedia] = React.useState<FeedMediaItem[]>([]);
  const [topPerformer, setTopPerformer] = React.useState<{
    name: string;
    points: number;
    teamName: string;
    goals: number;
    assists: number;
    isLady: boolean;
    playerId: string;
  } | null>(null);
  const [upcomingMatches, setUpcomingMatches] = React.useState<ApiMatch[]>([]);
  const [topLady, setTopLady] = React.useState<{
    name: string;
    points: number;
    teamName: string;
    avatarUrl: string | null;
    position: string | null;
    goals: number;
    assists: number;
    playerId: string;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [resultIdx, setResultIdx] = React.useState(0);
  const [fixtureIdx, setFixtureIdx] = React.useState(0);

  // Gameweek context
  const [currentGW, setCurrentGW] = React.useState<GWInfo | null>(null);
  const [nextGW, setNextGW] = React.useState<GWInfo | null>(null);

  // Fantasy quick-glance
  const [fantasyStats, setFantasyStats] = React.useState<FantasyQuickStats>(null);
  const [fantasyLoading, setFantasyLoading] = React.useState(true);
  const [isLoggedIn, setIsLoggedIn] = React.useState<boolean | null>(null);

  // Polling: track first load, previous scores, changed match IDs, and last-updated time
  const firstLoad = React.useRef(true);
  const prevScores = React.useRef<Map<string, string>>(new Map());
  const [changedIds, setChangedIds] = React.useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [ago, setAgo] = React.useState("");

  const loadDashboard = React.useCallback(async () => {
    try {
      // Only show loading skeleton on the very first load
      if (firstLoad.current) setLoading(true);

      // 1. Fetch teams + standings + gameweeks + players in parallel
      const [teamsRes, standingsRes, gwRes, playersRes] = await Promise.all([
        fetch("/api/teams", { cache: "no-store" }),
        fetch("/api/standings", { cache: "no-store" }),
        fetch("/api/gameweeks/current", { cache: "no-store" }),
        fetch("/api/players?dynamic_points=1", { cache: "no-store" }),
      ]);

      const teamsJson = await teamsRes.json();
      const standingsJson = await standingsRes.json();
      const gwJson = await gwRes.json();
      const playersJson = await playersRes.json();

      setTeams(teamsJson.teams ?? []);
      setTable((standingsJson.rows ?? []) as Row[]);

      // Find best performing lady player
      const allPlayers = playersJson.players ?? [];
      const ladies = allPlayers.filter((p: any) => p.isLady && (p.points ?? 0) > 0);
      if (ladies.length > 0) {
        const best = ladies.sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0))[0];
        setTopLady({
          name: best.name,
          points: best.points ?? 0,
          teamName: best.teamName ?? "—",
          avatarUrl: best.avatarUrl ?? null,
          position: best.position ?? null,
          goals: best.totalGoals ?? 0,
          assists: best.totalAssists ?? 0,
          playerId: best.id,
        });
      }

      const currentGwId = gwJson.current?.id;
      const nextGwId = gwJson.next?.id;
      const allGws: number[] = (gwJson.all ?? []).map((g: any) => g.id);

      // Store full GW objects for hero context
      setCurrentGW(gwJson.current ?? null);
      setNextGW(gwJson.next ?? null);

      // Fetch fantasy leaderboard + session for "My Fantasy" card
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        setIsLoggedIn(!!userId);

        if (userId) {
          const lbRes = await fetch("/api/fantasy-leaderboard", {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (lbRes.ok) {
            const lbJson = await lbRes.json();
            const entries = lbJson.leaderboard ?? [];
            const me = entries.find((e: any) => e.userId === userId);
            if (me) {
              // GW points: try current GW first, then fall back to the
              // latest GW that has data (handles unplayed upcoming GWs)
              let myGwPts = me.gwBreakdown?.[currentGwId] ?? 0;
              if (myGwPts === 0 && me.gwBreakdown) {
                const gwIds = Object.keys(me.gwBreakdown)
                  .map(Number)
                  .filter((n) => Number.isFinite(n) && n > 0)
                  .sort((a, b) => b - a);
                for (const gid of gwIds) {
                  if (me.gwBreakdown[gid] > 0) {
                    myGwPts = me.gwBreakdown[gid];
                    break;
                  }
                }
              }

              let myTotalPts = me.totalPoints ?? 0;

              // Fallback: if leaderboard has 0 points, compute from roster + player_stats
              if (myTotalPts === 0 || myGwPts === 0) {
                try {
                  const rosterRes = await fetch(
                    `/api/rosters/current?user_id=${userId}`,
                    { cache: "no-store" }
                  );
                  if (rosterRes.ok) {
                    const rosterJson = await rosterRes.json();
                    const squadIds: string[] = rosterJson?.squadIds ?? [];
                    const startingIds: string[] =
                      rosterJson?.startingIds?.length > 0
                        ? rosterJson.startingIds
                        : squadIds;

                    if (squadIds.length > 0) {
                      // Walk backward from current GW to find one with player data
                      const startGw = currentGwId ?? nextGwId ?? 1;
                      for (let gw = startGw; gw >= 1 && myGwPts === 0; gw--) {
                        const sRes = await fetch(
                          `/api/player-stats?gw_id=${gw}`,
                          { cache: "no-store" }
                        );
                        if (!sRes.ok) continue;
                        const sJson = await sRes.json();

                        const ptsById = new Map<string, number>();
                        for (const s of sJson?.stats ?? []) {
                          const pid = String((s as any).playerId ?? "");
                          if (!pid || !squadIds.includes(pid)) continue;
                          const pts = Number((s as any).points ?? 0);
                          ptsById.set(pid, (ptsById.get(pid) ?? 0) + (Number.isFinite(pts) ? pts : 0));
                        }
                        if (ptsById.size === 0) continue;

                        const mults: Record<string, number> =
                          rosterJson?.multiplierByPlayer ?? {};
                        myGwPts = startingIds.reduce((sum, id) => {
                          const pid = String(id);
                          const p = ptsById.get(pid) ?? 0;
                          const rm = Number(
                            mults[pid] ??
                              (String(rosterJson?.captainId ?? "") === pid ? 2 : 1)
                          );
                          const m = Number.isFinite(rm) && rm > 0 ? rm : 1;
                          return sum + p * m;
                        }, 0);
                      }

                      // Use GW points as total if leaderboard total was also 0
                      if (myTotalPts === 0 && myGwPts > 0) {
                        myTotalPts = myGwPts;
                      }
                    }
                  }
                } catch {
                  // non-fatal
                }
              }

              setFantasyStats({
                rank: me.rank,
                totalPoints: myTotalPts,
                gwPoints: myGwPts,
                teamName: me.teamName ?? "My Team",
              });
            } else {
              setFantasyStats(null);
            }
          }
        }
      } catch {
        // Fantasy stats are optional — don't block dashboard
      } finally {
        setFantasyLoading(false);
      }

      // Recent: fetch played matches from all gameweeks up to current
      const gwsToFetchPlayed = allGws.filter((id: number) => id <= (currentGwId ?? 0));
      const recentFetches = gwsToFetchPlayed.map((gwId: number) =>
        fetch(`/api/matches?gw_id=${gwId}&played=1&enrich=1`, { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => j.matches ?? [])
          .catch(() => [])
      );

      // Upcoming: unplayed matches from current AND next GW
      const upcomingGwIds = [...new Set([currentGwId, nextGwId].filter(Boolean))] as number[];
      const upcomingFetches = upcomingGwIds.map((gw) =>
        fetch(`/api/matches?gw_id=${gw}&played=0`, { cache: "no-store" })
          .then((r) => r.json())
          .then((j) => j.matches ?? [])
          .catch(() => [])
      );

      // Feed: transfer activity + top GW performer + admin media (parallel with match fetches)
      const transferFetch = fetch("/api/transfers/activity?limit=5", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { transfers: [] }))
        .catch(() => ({ transfers: [] }));
      const topPerfFetch = currentGwId
        ? fetch(`/api/player-stats?gw_id=${currentGwId}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : { stats: [] }))
            .catch(() => ({ stats: [] }))
        : Promise.resolve({ stats: [] });
      const mediaFetch = fetch("/api/feed-media", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .catch(() => ({ items: [] }));

      const [recentArrays, txData, perfData, mediaData, ...upcomingArrays] = await Promise.all([
        Promise.all(recentFetches),
        transferFetch,
        topPerfFetch,
        mediaFetch,
        ...upcomingFetches,
      ]);
      const upcoming = upcomingArrays.flat();

      const allPlayed: ApiMatch[] = recentArrays.flat();

      // For the "Latest result" card, only show the most recent GW's results
      const maxPlayedGw = allPlayed.reduce((max, m) => Math.max(max, m.gameweek_id ?? 0), 0);
      const newRecent = allPlayed.filter((m) => m.gameweek_id === maxPlayedGw);

      // If top performer fetch returned empty (current GW has no stats yet),
      // retry with the latest GW that actually has played matches
      let perfStats: any[] = perfData.stats ?? [];
      if (perfStats.length === 0 && maxPlayedGw > 0 && maxPlayedGw !== currentGwId) {
        try {
          const fallbackRes = await fetch(`/api/player-stats?gw_id=${maxPlayedGw}`, { cache: "no-store" });
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            perfStats = fallbackJson.stats ?? [];
          }
        } catch {
          // non-fatal
        }
      }

      // Detect score changes (skip on first load)
      if (!firstLoad.current) {
        const changed = new Set<string>();
        for (const m of newRecent) {
          const key = m.id;
          const score = `${m.home_goals ?? "-"}-${m.away_goals ?? "-"}`;
          const prev = prevScores.current.get(key);
          if (prev !== undefined && prev !== score) {
            changed.add(key);
          }
        }
        if (changed.size > 0) {
          setChangedIds(changed);
          setTimeout(() => setChangedIds(new Set()), 3000);
        }
      }

      // Update previous scores map
      const nextScores = new Map<string, string>();
      for (const m of newRecent) {
        nextScores.set(m.id, `${m.home_goals ?? "-"}-${m.away_goals ?? "-"}`);
      }
      prevScores.current = nextScores;

      setRecentMatches(newRecent);
      setUpcomingMatches(upcoming);

      // Feed: transfers + top performer + admin media
      setTransfers(txData.transfers ?? []);
      setFeedMedia(mediaData.items ?? []);
      const sortedPerf = perfStats
        .sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0));
      if (sortedPerf.length > 0) {
        const best = sortedPerf[0];
        setTopPerformer({
          name: best.playerName ?? best.player?.name ?? best.name ?? "—",
          points: best.points ?? 0,
          teamName: best.player?.teamShort ?? best.player?.teamName ?? best.teamShortName ?? best.teamName ?? "—",
          goals: best.goals ?? 0,
          assists: best.assists ?? 0,
          isLady: best.player?.isLady ?? best.isLady ?? false,
          playerId: best.playerId ?? "",
        });
      } else {
        setTopPerformer(null);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error("Dashboard load error:", e);
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }, []);

  // Poll every 30 seconds
  React.useEffect(() => {
    loadDashboard();
    const timer = setInterval(loadDashboard, 30_000);
    return () => clearInterval(timer);
  }, [loadDashboard]);

  // "Updated Xs ago" ticker
  React.useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => {
      const s = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
      setAgo(s < 5 ? "just now" : `${s}s ago`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  // Auto-rotate latest result every 15s
  React.useEffect(() => {
    if (recentMatches.length <= 1) return;
    const timer = setInterval(() => {
      setResultIdx((i) => (i + 1) % recentMatches.length);
    }, 15000);
    return () => clearInterval(timer);
  }, [recentMatches.length]);

  // Auto-rotate next fixture every 15s
  React.useEffect(() => {
    if (upcomingMatches.length <= 1) return;
    const timer = setInterval(() => {
      setFixtureIdx((i) => (i + 1) % upcomingMatches.length);
    }, 15000);
    return () => clearInterval(timer);
  }, [upcomingMatches.length]);

  const visibleRows = expanded ? table : table.slice(0, 5);

  const latestResult = recentMatches[resultIdx] ?? null;
  const nextFixture = upcomingMatches[fixtureIdx] ?? null;

  // Detect if any match is "live" (started by admin but not yet ended)
  const hasLiveMatch = recentMatches.some((m) => m.is_played && !m.is_final);

  // Deadline countdown for current gameweek (fallback to next only if current is missing)
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

  const staggerStyle = { animationFillMode: "forwards" as const };

  return (
    <div className="space-y-4 animate-in fade-in-50">

      {/* ── Zone 0: Header strip ── */}
      <section className={cn("opacity-0 animate-slide-up animate-stagger-1")} style={staggerStyle}>
        <div className="flex items-center gap-3 pt-2 bg-background">
          <Image
            src="/tbl-logo.png"
            alt="The Budo League"
            width={120}
            height={56}
            className="h-auto w-[100px] object-contain shrink-0"
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
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold", deadlinePillClass)}>
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

      {/* ── Zone 1: Fantasy Hero scoreboard ── */}
      <section className={cn("opacity-0 animate-slide-up animate-stagger-2")} style={staggerStyle}>
        <Link href="/dashboard/fantasy" className="block">
          <div className="rounded-2xl bg-gradient-to-br from-[#37003C] via-[#4a0050] to-[#1a0025] p-5 relative overflow-hidden">
            <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -right-4 -bottom-6 h-20 w-20 rounded-full bg-white/5 pointer-events-none" />
            <div className="relative">
              {fantasyLoading && isLoggedIn === null ? (
                <div className="flex items-center justify-around gap-4">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
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
                        {fantasyStats.gwPoints ?? "—"}
                      </span>
                      <span className="text-[10px] text-white/60 font-medium mt-1">GW pts</span>
                    </div>
                    <div className="h-10 w-px bg-white/20" />
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-1">
                        <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-2xl font-bold tabular-nums text-white leading-none">
                          {fantasyStats.rank ?? "—"}
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
                  <div className="text-white font-semibold">No scores yet — pick your team →</div>
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

      {/* ── Zone 2: League Pulse — result + fixture side by side ── */}
      <section className={cn("opacity-0 animate-slide-up animate-stagger-2")} style={staggerStyle}>
        <div className="grid grid-cols-2 gap-3">
          {/* Latest result */}
          <div className="rounded-2xl border bg-card p-3 shadow-[var(--shadow-1)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Result</span>
              {recentMatches.length > 1 && (
                <span className="text-[9px] text-muted-foreground tabular-nums">{resultIdx + 1}/{recentMatches.length}</span>
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
                <div className="text-[11px] font-medium text-center leading-tight truncate w-full">
                  {latestResult.home_team?.short_name ?? "—"}
                </div>
                <div className={cn(
                  "text-xl font-black font-mono tabular-nums",
                  changedIds.has(latestResult.id) && "text-emerald-500 animate-pulse"
                )}>
                  {latestResult.home_goals ?? "-"} - {latestResult.away_goals ?? "-"}
                </div>
                <div className="text-[11px] font-medium text-center leading-tight truncate w-full">
                  {latestResult.away_team?.short_name ?? "—"}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground text-center py-3">No results yet</div>
            )}
          </div>

          {/* Next fixture */}
          <div className="rounded-2xl border bg-card p-3 shadow-[var(--shadow-1)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Next Up</span>
              {upcomingMatches.length > 1 && (
                <span className="text-[9px] text-muted-foreground tabular-nums">{fixtureIdx + 1}/{upcomingMatches.length}</span>
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
                <div className="text-[11px] font-semibold leading-tight">
                  {nextFixture.home_team?.short_name ?? "—"} vs {nextFixture.away_team?.short_name ?? "—"}
                </div>
                <div className="text-[10px] text-muted-foreground">{formatKickoff(nextFixture.kickoff_time)}</div>
              </div>
            ) : (
              <div className="text-[11px] text-muted-foreground text-center py-3">No fixtures yet</div>
            )}
          </div>
        </div>
      </section>

      {/* ── Zone 3: Star Players — Lady + GW Best side by side ── */}
      <section className={cn("opacity-0 animate-slide-up animate-stagger-3")} style={staggerStyle}>
        <div className="grid grid-cols-2 gap-3">
          {/* Best Lady */}
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
                      <img src={topLady.avatarUrl} alt={topLady.name} className="h-10 w-10 rounded-xl object-cover border-2 border-pink-300/50" />
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
                  <div className="text-sm font-bold text-pink-600 dark:text-pink-400 tabular-nums">{topLady.points} pts</div>
                </div>
              </Link>
            ) : (
              <div className="text-[11px] text-muted-foreground text-center py-3">Pending</div>
            )}
          </div>

          {/* GW Top Performer */}
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
                    <div className="text-[11px] font-semibold text-white leading-tight truncate w-full">{topPerformer.name}</div>
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

      {/* ── Zone 4: League Table ── */}
      <section className={cn("opacity-0 animate-slide-up animate-stagger-3")} style={staggerStyle}>
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-headline">League snapshot</CardTitle>
              {table.length > 5 && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {expanded ? "Show less" : "View full standings"}
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            {loading ? (
              <div className="px-2 py-3 space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                    <Skeleton className="h-4 flex-1 rounded" />
                    <Skeleton className="h-4 w-6 rounded" />
                    <Skeleton className="h-4 w-6 rounded" />
                    <Skeleton className="h-4 w-8 rounded" />
                  </div>
                ))}
              </div>
            ) : table.length === 0 ? (
              <div className="px-2 py-6 text-sm text-muted-foreground">No table data yet.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="w-[42px] pl-2 pr-1">Pos</TableHead>
                    <TableHead className="w-[140px] pr-1">Team</TableHead>
                    <TableHead className="w-[28px] px-1 text-center">PL</TableHead>
                    <TableHead className="w-[28px] px-1 text-center">W</TableHead>
                    <TableHead className="w-[32px] px-1 text-center">GD</TableHead>
                    <TableHead className="w-[28px] px-1 text-center">LP</TableHead>
                    <TableHead className="w-[32px] px-1 text-center">Pts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((r, idx) => {
                    const pos = idx + 1;
                    const bar = posBarClass(pos);
                    return (
                      <TableRow key={r.teamId} className="text-[12px]">
                        <TableCell className="py-2 pl-2 pr-1">
                          <div className="flex items-center gap-1.5">
                            <div className={`h-5 w-1.5 rounded-full ${bar}`} />
                            <span className="font-semibold tabular-nums">{pos}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 pr-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <Image src={r.logoUrl} alt={r.name} width={20} height={20} className="rounded-full shrink-0" />
                            <span className="truncate text-[12px] font-medium">{r.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.PL}</TableCell>
                        <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.W}</TableCell>
                        <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.GD}</TableCell>
                        <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-pink-600">{r.LP}</TableCell>
                        <TableCell className="py-2 px-1 text-center font-mono font-bold tabular-nums">{r.Pts}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {!loading && table.length > 0 && (
              <div className="pt-3 px-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-1.5 rounded-full bg-emerald-500" />
                  <span>Main Cup</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-1.5 rounded-full bg-amber-500" />
                  <span>Semivule Cup</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── Zone 5: Activity Feed ── */}
      <div className={cn("space-y-3 opacity-0 animate-slide-up animate-stagger-4")} style={staggerStyle}>
        <div className="flex items-center justify-between px-1">
          <h2 className="flex items-center gap-2 text-base font-headline font-semibold">
            <Newspaper className="h-4 w-4" /> Latest
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-[180px] w-full rounded-2xl" />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pinned media hero */}
            {(() => {
              const pinned = feedMedia.find((m) => m.is_pinned);
              if (!pinned) return null;
              const hasVideo = !!pinned.video_url;
              const mediaUrl = pinned.video_url || pinned.image_url;
              return (
                <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 180 }}>
                  {hasVideo ? (
                    <video src={pinned.video_url!} muted loop autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
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
                      <div className="text-white/70 text-xs mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(pinned.body) }} />
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Match results */}
            {recentMatches.slice(0, 3).map((m) => (
              <Link
                key={m.id}
                href={`/match/${m.id}`}
                className="block rounded-2xl border bg-card p-3 shadow-[var(--shadow-1)] hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <CategoryPill category="result" />
                  <span className="text-[10px] text-muted-foreground">
                    {m.kickoff_time ? timeAgo(m.kickoff_time) : ""}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {m.home_team?.logo_url && (
                      <Image src={m.home_team.logo_url} alt={m.home_team.short_name} width={24} height={24} className="rounded-full shrink-0" />
                    )}
                    <span className="text-sm font-medium truncate">{m.home_team?.short_name ?? "—"}</span>
                  </div>
                  <div className={cn(
                    "shrink-0 rounded-lg bg-foreground/5 px-3 py-1 text-base font-bold font-mono tabular-nums",
                    changedIds.has(m.id) && "text-emerald-500 animate-pulse"
                  )}>
                    {m.home_goals ?? "-"} - {m.away_goals ?? "-"}
                  </div>
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <span className="text-sm font-medium truncate text-right">{m.away_team?.short_name ?? "—"}</span>
                    {m.away_team?.logo_url && (
                      <Image src={m.away_team.logo_url} alt={m.away_team.short_name} width={24} height={24} className="rounded-full shrink-0" />
                    )}
                  </div>
                </div>
                {(m.home_events?.some((e) => e.goals > 0) || m.away_events?.some((e) => e.goals > 0)) && (
                  <div className="mt-2 pt-2 border-t text-[11px] text-muted-foreground truncate">
                    {[
                      ...(m.home_events?.filter((e) => e.goals > 0).map((e) =>
                        `${e.playerName}${e.goals > 1 ? ` (${e.goals})` : ""}`
                      ) ?? []),
                      ...(m.away_events?.filter((e) => e.goals > 0).map((e) =>
                        `${e.playerName}${e.goals > 1 ? ` (${e.goals})` : ""}`
                      ) ?? []),
                    ].join(", ")}
                  </div>
                )}
              </Link>
            ))}

            {/* Transfer activity */}
            {transfers.slice(0, 3).map((t: any, i: number) => (
              <div
                key={`tx-${i}`}
                className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-[var(--shadow-1)]"
              >
                <Repeat2 className="h-4 w-4 text-purple-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">
                    <span className="font-medium">{t.managerTeam ?? "A manager"}</span>
                    {" signed "}
                    <span className="font-semibold">{t.playerIn?.webName ?? t.playerIn?.name ?? "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CategoryPill category="transfer" />
                  {t.createdAt && (
                    <span className="text-[10px] text-muted-foreground">{timeAgo(t.createdAt)}</span>
                  )}
                </div>
              </div>
            ))}

            {/* Admin media thumbnails (non-pinned) */}
            {feedMedia
              .filter((m) => !m.is_pinned)
              .slice(0, 4)
              .map((m) => {
                const layout = m.layout || "hero";
                const thumbUrl = m.thumbnail_url || m.image_url;
                const hasVideo = !!m.video_url;
                const isGallery = layout === "gallery" && m.media_urls && m.media_urls.length > 0;
                const isQuick = layout === "quick";

                // Quick update layout (text-only, accent border)
                if (isQuick) {
                  return (
                    <div key={`media-${m.id}`} className="rounded-2xl border-l-4 border-purple-500 bg-card p-3 shadow-[var(--shadow-1)]">
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryPill category={m.category} />
                        <span className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                      </div>
                      <div className="text-sm font-semibold leading-tight">{m.title}</div>
                      {m.body && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.body!) }} />
                      )}
                    </div>
                  );
                }

                // Split layout
                if (layout === "split") {
                  return (
                    <div key={`media-${m.id}`} className="flex rounded-2xl border bg-card overflow-hidden shadow-[var(--shadow-1)]">
                      {thumbUrl && (
                        <div className="w-2/5 shrink-0 relative">
                          <img src={thumbUrl} alt={m.title} className="w-full h-full min-h-[100px] object-cover" />
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
                          <CategoryPill category={m.category} />
                          <span className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                        </div>
                        <div className="text-sm font-semibold leading-tight line-clamp-2">{m.title}</div>
                        {m.body && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.body!) }} />
                        )}
                      </div>
                    </div>
                  );
                }

                // Feature layout (headline first, image below)
                if (layout === "feature") {
                  return (
                    <div key={`media-${m.id}`} className="rounded-2xl border bg-card overflow-hidden shadow-[var(--shadow-1)]">
                      <div className="p-3 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <CategoryPill category={m.category} />
                          <span className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                        </div>
                        <div className="text-base font-bold leading-tight">{m.title}</div>
                        {m.body && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.body!) }} />
                        )}
                      </div>
                      {thumbUrl && (
                        <img src={thumbUrl} alt={m.title} className="w-full h-32 object-cover" />
                      )}
                    </div>
                  );
                }

                // Gallery layout
                if (isGallery) {
                  const imgs = m.media_urls!;
                  return (
                    <div key={`media-${m.id}`} className="rounded-2xl border bg-card overflow-hidden shadow-[var(--shadow-1)]">
                      <div className="p-3 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <CategoryPill category={m.category} />
                          <span className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                        </div>
                        <div className="text-sm font-semibold leading-tight">{m.title}</div>
                      </div>
                      <div className="flex gap-0.5 px-0.5 pb-0.5">
                        {imgs.slice(0, 3).map((url, i) => (
                          <div key={i} className="flex-1 relative">
                            <img src={url} alt="" className="w-full h-20 object-cover" />
                            {i === 2 && imgs.length > 3 && (
                              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                <span className="text-white font-bold text-sm">+{imgs.length - 3}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                // Default: hero / video thumbnail card
                return (
                  <div
                    key={`media-${m.id}`}
                    className="flex gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-1)]"
                  >
                    {thumbUrl ? (
                      <div className="relative shrink-0">
                        <img src={thumbUrl} alt={m.title} className="h-20 w-20 rounded-xl object-cover" />
                        {hasVideo && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-7 h-7 rounded-full bg-black/50 flex items-center justify-center">
                              <div className="w-0 h-0 border-l-[8px] border-l-white border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent ml-0.5" />
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="h-20 w-20 rounded-xl bg-muted shrink-0 flex items-center justify-center">
                        <span className="text-xs text-muted-foreground">No img</span>
                      </div>
                    )}
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryPill category={m.category} />
                        <span className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                      </div>
                      <div className="text-sm font-semibold leading-tight line-clamp-2">{m.title}</div>
                      {m.body && (
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(m.body!) }} />
                      )}
                    </div>
                  </div>
                );
              })}

            {/* Deadline reminder */}
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
                <Clock className={cn(
                  "h-5 w-5 shrink-0",
                  deadlineCountdown.tone === "critical" ? "text-red-500"
                    : deadlineCountdown.tone === "urgent" ? "text-orange-500"
                    : "text-amber-500"
                )} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    GW {deadlineGameweek?.id} deadline in {deadlineCountdown.label}
                  </div>
                  <div className="text-xs text-muted-foreground">Make your transfers before it closes</div>
                </div>
                <CategoryPill category="deadline" />
              </Link>
            )}

            {/* League leader */}
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

            {/* Empty state */}
            {recentMatches.length === 0 && transfers.length === 0 && table.length === 0 && feedMedia.length === 0 && (
              <div className="rounded-2xl border bg-card py-8 text-center text-sm text-muted-foreground">
                No updates yet — check back once matches begin.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Zone 6: Quick Actions ── */}
      <section className={cn("opacity-0 animate-slide-up animate-stagger-4")} style={staggerStyle}>
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
