"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
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
  image_url: string;
  category: string;
  is_pinned: boolean;
  gameweek_id: number | null;
  created_at: string;
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
      const sortedPerf = (perfData.stats ?? [])
        .sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0));
      if (sortedPerf.length > 0) {
        const best = sortedPerf[0];
        setTopPerformer({
          name: best.playerName ?? best.name ?? "—",
          points: best.points ?? 0,
          teamName: best.teamShortName ?? best.teamName ?? "—",
          goals: best.goals ?? 0,
          assists: best.assists ?? 0,
          isLady: best.isLady ?? false,
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

  const visibleRows = expanded ? table : table.slice(0, 8);

  const latestResult = recentMatches[resultIdx] ?? null;
  const nextFixture = upcomingMatches[fixtureIdx] ?? null;

  // Detect if any match is "live" (started by admin but not yet ended)
  const hasLiveMatch = recentMatches.some(
    (m) => m.is_played && !m.is_final
  );

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
      {/* ── Hero: compact horizontal row ── */}
      <section
        className={cn("opacity-0 animate-slide-up animate-stagger-1")}
        style={staggerStyle}
      >
        <div className="flex items-center gap-3 pt-2 bg-background">
          {/* Logo — shrunk to ~100px */}
          <Image
            src="/tbl-logo.png"
            alt="The Budo League"
            width={120}
            height={56}
            className="h-auto w-[100px] object-contain shrink-0"
            priority
          />

          {/* Right: GW context + deadline + updated */}
          <div className="flex-1 min-w-0 flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="inline-block rounded-full bg-foreground/10 px-3 py-0.5 text-[10px] font-bold tracking-widest text-foreground/70 uppercase">
                Season 9
              </span>
              {currentGW && (
                <span className="text-[11px] font-semibold text-foreground/80">
                  GW {currentGW.id}
                </span>
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

            {/* Deadline countdown pill */}
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

            {/* Updated indicator */}
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground/70">
                Updated {ago}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── My Fantasy quick-glance + Best Lady ── */}
      <section
        className={cn("space-y-3 opacity-0 animate-slide-up animate-stagger-2")}
        style={staggerStyle}
      >
        {/* My Fantasy Card */}
        <Link href="/dashboard/fantasy" className="block">
          <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-1)]">
            {fantasyLoading && isLoggedIn === null ? (
              /* Loading skeleton: 3-column */
              <div className="flex items-center justify-around gap-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <Skeleton className="h-7 w-12 rounded" />
                    <Skeleton className="h-3 w-14 rounded" />
                  </div>
                ))}
              </div>
            ) : isLoggedIn && fantasyStats ? (
              /* Logged in + has data: 3-column */
              <div className="flex items-center justify-around gap-4">
                <div className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    <Trophy className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xl font-bold tabular-nums font-headline">
                      {fantasyStats.rank ?? "—"}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Rank</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold tabular-nums font-headline">
                    {fantasyStats.totalPoints}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">Total pts</span>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="flex flex-col items-center">
                  <span className="text-xl font-bold tabular-nums font-headline">
                    {fantasyStats.gwPoints ?? "—"}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-medium">GW pts</span>
                </div>
              </div>
            ) : isLoggedIn ? (
              /* Logged in, no data */
              <div className="text-center text-sm text-muted-foreground py-1">
                No scores yet — <span className="font-semibold text-primary">pick your team</span>
              </div>
            ) : (
              /* Not logged in */
              <div className="text-center text-sm text-muted-foreground py-1">
                <span className="font-semibold text-primary">Sign in</span> to play fantasy
              </div>
            )}
          </div>
        </Link>

          {/* Best Lady Player */}
          <Card className="rounded-3xl overflow-hidden border-pink-200/40 dark:border-pink-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-headline">
                <Crown className="h-4 w-4 text-pink-500" />
                Best Lady Player
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28 rounded" />
                    <Skeleton className="h-3 w-20 rounded" />
                    <Skeleton className="h-3 w-16 rounded" />
                  </div>
                </div>
              ) : topLady ? (
                <Link
                  href={`/dashboard/players/${topLady.playerId}`}
                  className="flex items-center gap-4 group"
                >
                  <div className="relative shrink-0">
                    {topLady.avatarUrl ? (
                      <img
                        src={topLady.avatarUrl}
                        alt={topLady.name}
                        className="h-16 w-16 rounded-2xl object-cover border-2 border-pink-300/50"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-100 to-pink-200 dark:from-pink-900/40 dark:to-pink-800/30 border-2 border-pink-300/50 flex items-center justify-center">
                        <span className="text-2xl font-bold text-pink-500/70">
                          {topLady.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-pink-500 flex items-center justify-center">
                      <Crown className="h-3 w-3 text-white" />
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate group-hover:text-pink-500 transition-colors">
                      {topLady.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {topLady.teamName} &middot; {topLady.position ?? "—"}
                    </div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs">
                      <span className="font-bold text-pink-600 dark:text-pink-400 tabular-nums">
                        {topLady.points} pts
                      </span>
                      {topLady.goals > 0 && (
                        <span className="text-muted-foreground tabular-nums">
                          {topLady.goals}G
                        </span>
                      )}
                      {topLady.assists > 0 && (
                        <span className="text-muted-foreground tabular-nums">
                          {topLady.assists}A
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Lady player stats will appear once matches are played.
                </div>
              )}
            </CardContent>
          </Card>

      </section>

      {/* ── Action buttons ── */}
      <section
        className={cn("opacity-0 animate-slide-up animate-stagger-3")}
        style={staggerStyle}
      >
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

      <div
        className={cn("grid gap-4 lg:grid-cols-[1.15fr_0.85fr] opacity-0 animate-slide-up animate-stagger-3")}
        style={staggerStyle}
      >
        {/* League table */}
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-headline">
                League snapshot
              </CardTitle>
              {table.length > 8 && (
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
                {Array.from({ length: 8 }).map((_, i) => (
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
              <div className="px-2 py-6 text-sm text-muted-foreground">
                No table data yet.
              </div>
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
                            <span className="font-semibold tabular-nums">
                              {pos}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-2 pr-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <Image
                              src={r.logoUrl}
                              alt={r.name}
                              width={20}
                              height={20}
                              className="rounded-full shrink-0"
                            />
                            <span className="truncate text-[12px] font-medium">
                              {r.name}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-1 text-center font-mono tabular-nums">
                          {r.PL}
                        </TableCell>
                        <TableCell className="py-2 px-1 text-center font-mono tabular-nums">
                          {r.W}
                        </TableCell>
                        <TableCell className="py-2 px-1 text-center font-mono tabular-nums">
                          {r.GD}
                        </TableCell>
                        <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-pink-600">
                          {r.LP}
                        </TableCell>
                        <TableCell className="py-2 px-1 text-center font-mono font-bold tabular-nums">
                          {r.Pts}
                        </TableCell>
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

        {/* Right column */}
        <div className="space-y-4">
          <Card className="rounded-3xl overflow-hidden shadow-[var(--shadow-1)]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-headline">
                  Latest result
                </CardTitle>
                {recentMatches.length > 1 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">{resultIdx + 1}/{recentMatches.length}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3 py-1">
                  <Skeleton className="h-3 w-20 rounded" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-40 rounded" />
                    <Skeleton className="h-6 w-14 rounded" />
                  </div>
                </div>
              ) : latestResult ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {formatShortDate(latestResult.kickoff_time)}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {latestResult.home_team?.name ?? "—"} vs {latestResult.away_team?.name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {latestResult.home_team?.short_name ?? "—"} - {latestResult.away_team?.short_name ?? "—"}
                      </div>
                    </div>
                    <div className={`shrink-0 text-lg font-bold font-mono tabular-nums transition-colors duration-300 ${latestResult && changedIds.has(latestResult.id) ? "text-emerald-500 animate-pulse" : ""}`}>
                      {(latestResult.home_goals ?? "-") + " - " + (latestResult.away_goals ?? "-")}
                    </div>
                  </div>
                  {/* Goal scorers */}
                  {(latestResult.home_events?.length || latestResult.away_events?.length) ? (
                    <div className="space-y-1 text-xs text-muted-foreground border-t pt-2">
                      {latestResult.home_events?.filter((e) => e.goals > 0).map((e) => (
                        <div key={e.playerId}>
                          {e.playerName} {e.goals > 1 ? `(${e.goals})` : ""} — {latestResult.home_team?.short_name}
                        </div>
                      ))}
                      {latestResult.away_events?.filter((e) => e.goals > 0).map((e) => (
                        <div key={e.playerId}>
                          {e.playerName} {e.goals > 1 ? `(${e.goals})` : ""} — {latestResult.away_team?.short_name}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No results recorded yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl overflow-hidden shadow-[var(--shadow-1)]">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-headline">Next fixture</CardTitle>
                {upcomingMatches.length > 1 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">{fixtureIdx + 1}/{upcomingMatches.length}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3 py-1">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-5 w-44 rounded" />
                  <Skeleton className="h-3 w-24 rounded" />
                </div>
              ) : nextFixture ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {formatShortDate(nextFixture.kickoff_time)}
                  </div>
                  <div className="text-sm font-semibold">
                    {nextFixture.home_team?.name ?? "—"} vs {nextFixture.away_team?.name ?? "—"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Kickoff {formatKickoff(nextFixture.kickoff_time)}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Fixtures will appear here once scheduled.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Latest Feed ── */}
      <div
        className={cn("space-y-3 opacity-0 animate-slide-up animate-stagger-4")}
        style={staggerStyle}
      >
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
            {/* ── Hero Card: pinned admin media or top performer ── */}
            {(() => {
              const pinned = feedMedia.find((m) => m.is_pinned);
              if (pinned) {
                return (
                  <div className="relative rounded-2xl overflow-hidden" style={{ minHeight: 180 }}>
                    <img
                      src={pinned.image_url}
                      alt={pinned.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                    <div className="relative flex flex-col justify-end p-4" style={{ minHeight: 180 }}>
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryPill category={pinned.category} />
                        <span className="text-[10px] text-white/50">{timeAgo(pinned.created_at)}</span>
                      </div>
                      <div className="text-white font-bold text-[15px] leading-tight">
                        {pinned.title}
                      </div>
                      {pinned.body && (
                        <div className="text-white/70 text-xs mt-1 line-clamp-2">
                          {pinned.body}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              // Fallback hero: top performer with gradient
              if (topPerformer) {
                return (
                  <Link
                    href={`/dashboard/players/${topPerformer.playerId}`}
                    className="block relative rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700"
                    style={{ minHeight: 140 }}
                  >
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_70%_30%,white_0%,transparent_60%)]" />
                    <div className="relative flex items-center gap-4 p-4" style={{ minHeight: 140 }}>
                      {/* Large initial */}
                      <div className="h-16 w-16 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                        <span className="text-3xl font-bold text-white/90">
                          {topPerformer.name.charAt(0)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CategoryPill category="player_spotlight" />
                          <span className="text-[10px] text-white/50">GW {currentGW?.id ?? "—"}</span>
                        </div>
                        <div className="text-white font-bold text-[15px] leading-tight">
                          Player of the Week
                        </div>
                        <div className="text-white/80 text-sm mt-0.5">
                          {topPerformer.name}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-white/70">
                          <span className="font-bold text-white tabular-nums">
                            {topPerformer.points}pts
                          </span>
                          {topPerformer.goals > 0 && (
                            <span className="tabular-nums">{topPerformer.goals}G</span>
                          )}
                          {topPerformer.assists > 0 && (
                            <span className="tabular-nums">{topPerformer.assists}A</span>
                          )}
                          <span>{topPerformer.teamName}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              }
              return null;
            })()}

            {/* ── Admin media cards (non-pinned, thumbnail style) ── */}
            {feedMedia
              .filter((m) => !m.is_pinned)
              .slice(0, 3)
              .map((m) => (
                <div
                  key={`media-${m.id}`}
                  className="flex gap-3 rounded-2xl border bg-card p-3 shadow-[var(--shadow-1)]"
                >
                  <img
                    src={m.image_url}
                    alt={m.title}
                    className="h-20 w-20 rounded-xl object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1">
                      <CategoryPill category={m.category} />
                      <span className="text-[10px] text-muted-foreground">{timeAgo(m.created_at)}</span>
                    </div>
                    <div className="text-sm font-semibold leading-tight line-clamp-2">
                      {m.title}
                    </div>
                    {m.body && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {m.body}
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {/* ── Deadline reminder (tinted card) ── */}
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
                  deadlineCountdown.tone === "critical"
                    ? "text-red-500"
                    : deadlineCountdown.tone === "urgent"
                    ? "text-orange-500"
                    : "text-amber-500"
                )} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    GW {deadlineGameweek?.id} deadline in {deadlineCountdown.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Make your transfers before it closes
                  </div>
                </div>
                <CategoryPill category="deadline" />
              </Link>
            )}

            {/* ── Match results (with team logos) ── */}
            {recentMatches.slice(0, 4).map((m) => (
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
                  {/* Home */}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {m.home_team?.logo_url && (
                      <Image
                        src={m.home_team.logo_url}
                        alt={m.home_team.short_name}
                        width={24}
                        height={24}
                        className="rounded-full shrink-0"
                      />
                    )}
                    <span className="text-sm font-medium truncate">
                      {m.home_team?.short_name ?? "—"}
                    </span>
                  </div>
                  {/* Score */}
                  <div className={cn(
                    "shrink-0 rounded-lg bg-foreground/5 px-3 py-1 text-base font-bold font-mono tabular-nums",
                    changedIds.has(m.id) && "text-emerald-500 animate-pulse"
                  )}>
                    {m.home_goals ?? "-"} - {m.away_goals ?? "-"}
                  </div>
                  {/* Away */}
                  <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                    <span className="text-sm font-medium truncate text-right">
                      {m.away_team?.short_name ?? "—"}
                    </span>
                    {m.away_team?.logo_url && (
                      <Image
                        src={m.away_team.logo_url}
                        alt={m.away_team.short_name}
                        width={24}
                        height={24}
                        className="rounded-full shrink-0"
                      />
                    )}
                  </div>
                </div>
                {/* Goal scorers */}
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

            {/* ── Transfer activity (compact) ── */}
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

            {/* ── League leader ── */}
            {table.length > 0 && (
              <Link
                href="/dashboard/standings"
                className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-[var(--shadow-1)] hover:bg-accent transition-colors"
              >
                <Trophy className="h-5 w-5 text-amber-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    League leader: {table[0].name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {table[0].Pts} pts · {table[0].W}W {table[0].D}D {table[0].L}L
                  </div>
                </div>
                <CategoryPill category="leader" />
              </Link>
            )}

            {/* ── Empty state ── */}
            {!topPerformer && recentMatches.length === 0 && transfers.length === 0 && table.length === 0 && feedMedia.length === 0 && (
              <div className="rounded-2xl border bg-card py-8 text-center text-sm text-muted-foreground">
                No updates yet — check back once matches begin.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
