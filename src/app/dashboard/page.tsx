"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, Crown, History, Trophy } from "lucide-react";
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
import { Button } from "@/components/ui/button";
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
  const [allPlayedMatches, setAllPlayedMatches] = React.useState<ApiMatch[]>([]);
  const [showAllResults, setShowAllResults] = React.useState(false);
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
      if (gwJson.current) setCurrentGW(gwJson.current);
      if (gwJson.next) setNextGW(gwJson.next);

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
              setFantasyStats({
                rank: me.rank,
                totalPoints: me.totalPoints ?? 0,
                gwPoints: me.gwBreakdown?.[currentGwId] ?? null,
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

      const [recentArrays, ...upcomingArrays] = await Promise.all([
        Promise.all(recentFetches),
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
      setAllPlayedMatches(allPlayed);
      setUpcomingMatches(upcoming);
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

  // Detect if any match is "live" (kicked off but not finalized)
  const hasLiveMatch = recentMatches.some(
    (m) => m.kickoff_time && new Date(m.kickoff_time).getTime() <= Date.now() && !m.is_final
  ) || upcomingMatches.some(
    (m) => m.kickoff_time && new Date(m.kickoff_time).getTime() <= Date.now()
  );

  // Deadline countdown for next GW
  const deadlineCountdown = useDeadlineCountdown(nextGW?.deadline_time);
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
          {/* Logo — shrunk to ~100px. bg-background on parent is required
              so mix-blend-multiply has a backdrop to composite against
              (the animation wrapper creates an isolated stacking context). */}
          <Image
            src="/tbl-logo.png"
            alt="The Budo League"
            width={120}
            height={56}
            className="h-auto w-[100px] object-contain mix-blend-multiply dark:invert dark:mix-blend-screen shrink-0"
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
                  ? "Deadline closed"
                  : `Deadline: ${deadlineCountdown.label}`}
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Button asChild className="rounded-2xl w-full">
            <Link href="/dashboard/more/tbl-rules">TBL fantasy rules</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl w-full">
            <Link href="/dashboard/fantasy">Open fantasy</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl w-full">
            <Link href="/dashboard/explore">Explore teams</Link>
          </Button>
          <Button asChild className="rounded-2xl w-full">
            <Link href="/dashboard/matches">Go to matches</Link>
          </Button>
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

      {/* Recent Results */}
      <Card
        className={cn("rounded-3xl opacity-0 animate-slide-up animate-stagger-4")}
        style={staggerStyle}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-headline">
            <History className="h-5 w-5" /> Recent results
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <div className="space-y-2">
            {loading ? (
              <div className="space-y-2 px-1 py-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border bg-card px-3 py-3">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="h-4 w-36 rounded" />
                      </div>
                      <Skeleton className="h-5 w-12 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : allPlayedMatches.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-4">
                No results have been recorded yet.
              </div>
            ) : (
              <>
                {(showAllResults ? allPlayedMatches : allPlayedMatches.slice(0, 3)).map((m) => (
                  <Link
                    key={m.id}
                    href={`/match/${m.id}`}
                    className="block rounded-2xl border bg-card px-3 py-3 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">
                          {formatShortDate(m.kickoff_time)}
                        </div>
                        <div className="truncate text-sm font-medium">
                          {m.home_team?.name ?? "—"} vs {m.away_team?.name ?? "—"}
                        </div>
                      </div>
                      <div className={`shrink-0 text-sm font-bold font-mono tabular-nums transition-colors duration-300 ${changedIds.has(m.id) ? "text-emerald-500 animate-pulse" : ""}`}>
                        {(m.home_goals ?? "-") + " - " + (m.away_goals ?? "-")}
                      </div>
                    </div>
                    {/* Enriched: goal scorers */}
                    {(m.home_events?.length || m.away_events?.length) ? (
                      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {m.home_events?.filter((e) => e.goals > 0).map((e) => (
                          <span key={e.playerId}>
                            {e.playerName} {e.goals > 1 ? `(${e.goals})` : ""}
                          </span>
                        ))}
                        {m.away_events?.filter((e) => e.goals > 0).map((e) => (
                          <span key={e.playerId}>
                            {e.playerName} {e.goals > 1 ? `(${e.goals})` : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </Link>
                ))}
                {allPlayedMatches.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllResults((prev) => !prev)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium text-primary hover:bg-accent transition-colors"
                  >
                    {showAllResults ? (
                      <>Show less <ChevronUp className="h-4 w-4" /></>
                    ) : (
                      <>See more results <ChevronDown className="h-4 w-4" /></>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
