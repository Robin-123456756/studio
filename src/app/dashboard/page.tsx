"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, ChevronDown, ChevronUp, History, Users } from "lucide-react";

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

export default function DashboardPage() {
  const [expanded, setExpanded] = React.useState(false);

  // Live data state
  const [teams, setTeams] = React.useState<ApiTeam[]>([]);
  const [table, setTable] = React.useState<Row[]>([]);
  const [recentMatches, setRecentMatches] = React.useState<ApiMatch[]>([]);
  const [showAllResults, setShowAllResults] = React.useState(false);
  const [upcomingMatches, setUpcomingMatches] = React.useState<ApiMatch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [resultIdx, setResultIdx] = React.useState(0);
  const [fixtureIdx, setFixtureIdx] = React.useState(0);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // 1. Fetch teams + standings + gameweeks in parallel
        const [teamsRes, standingsRes, gwRes] = await Promise.all([
          fetch("/api/teams", { cache: "no-store" }),
          fetch("/api/standings", { cache: "no-store" }),
          fetch("/api/gameweeks/current", { cache: "no-store" }),
        ]);

        const teamsJson = await teamsRes.json();
        const standingsJson = await standingsRes.json();
        const gwJson = await gwRes.json();

        setTeams(teamsJson.teams ?? []);
        setTable((standingsJson.rows ?? []) as Row[]);

        const currentGwId = gwJson.current?.id;
        const allGws: number[] = (gwJson.all ?? []).map((g: any) => g.id);

        // Recent: fetch played matches from all gameweeks up to current
        const gwsToFetchPlayed = allGws.filter((id: number) => id <= (currentGwId ?? 0));
        const recentFetches = gwsToFetchPlayed.map((gwId: number) =>
          fetch(`/api/matches?gw_id=${gwId}&played=1&enrich=1`, { cache: "no-store" })
            .then((r) => r.json())
            .then((j) => j.matches ?? [])
            .catch(() => [])
        );

        // Upcoming: current GW unplayed matches
        let upcomingFetch: Promise<any[]>;
        if (currentGwId) {
          upcomingFetch = fetch(`/api/matches?gw_id=${currentGwId}&played=0`, { cache: "no-store" })
            .then((r) => r.json())
            .then((j) => j.matches ?? [])
            .catch(() => []);
        } else {
          upcomingFetch = Promise.resolve([]);
        }

        const [recentArrays, upcoming] = await Promise.all([
          Promise.all(recentFetches),
          upcomingFetch,
        ]);

        setRecentMatches(recentArrays.flat());
        setUpcomingMatches(upcoming);
      } catch (e) {
        console.error("Dashboard load error:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] shadow-[var(--shadow-2)]">
        {/* Branded header with logo */}
        <div className="relative bg-[#0D5C63] px-5 pt-6 pb-10 overflow-hidden">
          {/* Decorative circles */}
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute -left-8 bottom-0 h-28 w-28 rounded-full bg-white/5" />
          <div className="pointer-events-none absolute right-1/4 top-1/2 h-20 w-20 rounded-full bg-white/[0.03]" />

          <div className="relative flex flex-col items-center text-center">
            <Image
              src="/tbl-logo.png"
              alt="The Budo League"
              width={200}
              height={90}
              className="h-auto w-[160px] sm:w-[190px] object-contain drop-shadow-lg"
              priority
            />
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-block rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-bold tracking-widest text-white/90 uppercase">
                Season 9
              </span>
            </div>
          </div>
        </div>

        {/* Stat cards — pulled up to overlap the branded header */}
        <div className="relative -mt-6 px-4 pb-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-1)]">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Teams</span>
                <Users className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold font-headline">
                {loading ? "—" : teams.length}
              </div>
              <div className="text-xs text-muted-foreground">Active clubs</div>
            </div>

            <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-1)]">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Fixtures</span>
                <Calendar className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold font-headline">
                {loading ? "—" : upcomingMatches.length}
              </div>
              <div className="text-xs text-muted-foreground">
                {upcomingMatches.length > 0 ? "Scheduled matches" : "Fixtures listed"}
              </div>
            </div>
          </div>

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
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
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
              <div className="px-2 py-6 text-sm text-muted-foreground">
                Loading table...
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
          <Card className="rounded-3xl overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-headline">Latest result</CardTitle>
                {recentMatches.length > 1 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">{resultIdx + 1}/{recentMatches.length}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
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
                    <div className="shrink-0 text-lg font-bold font-mono tabular-nums">
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

          <Card className="rounded-3xl overflow-hidden">
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
                <div className="text-sm text-muted-foreground">Loading...</div>
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
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-headline">
            <History className="h-5 w-5" /> Recent results
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <div className="space-y-2">
            {loading ? (
              <div className="text-sm text-muted-foreground px-2 py-4">
                Loading results...
              </div>
            ) : recentMatches.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-4">
                No results have been recorded yet.
              </div>
            ) : (
              <>
                {(showAllResults ? recentMatches : recentMatches.slice(0, 3)).map((m) => (
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
                      <div className="shrink-0 text-sm font-bold font-mono tabular-nums">
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
                {recentMatches.length > 3 && (
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
