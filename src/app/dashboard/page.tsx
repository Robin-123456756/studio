"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, History, Users } from "lucide-react";

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

import { teams, schedule, recentScores, type Game, type Team } from "@/lib/data";

// ---------- Standings logic (computed from completed games) ----------
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
  LP: number; // Lady points
  Pts: number;
};

function hasLadyOnField(game: Game, teamName: string) {
  // If you later set game.onField1/onField2 with gender info, LP will auto-work.
  const side1 =
    game.team1.name === teamName ? game.onField1?.players : undefined;
  const side2 =
    game.team2.name === teamName ? game.onField2?.players : undefined;

  const players = side1 ?? side2 ?? [];
  return players.some((p) => p.gender === "female");
}

function computeTable(allTeams: Team[], games: Game[]): Row[] {
  const map = new Map<string, Row>();

  for (const t of allTeams) {
    map.set(t.id, {
      teamId: t.id,
      name: t.name,
      logoUrl: t.logoUrl,
      PL: 0,
      W: 0,
      D: 0,
      L: 0,
      GF: 0,
      GA: 0,
      GD: 0,
      LP: 0,
      Pts: 0,
    });
  }

  const completed = games.filter(
    (g) =>
      g.status === "completed" &&
      typeof g.score1 === "number" &&
      typeof g.score2 === "number"
  );

  for (const g of completed) {
    const a = map.get(g.team1.id);
    const b = map.get(g.team2.id);
    if (!a || !b) continue;

    const s1 = g.score1 ?? 0;
    const s2 = g.score2 ?? 0;

    a.PL += 1;
    b.PL += 1;

    a.GF += s1;
    a.GA += s2;

    b.GF += s2;
    b.GA += s1;

    if (s1 > s2) {
      a.W += 1;
      b.L += 1;
    } else if (s1 < s2) {
      b.W += 1;
      a.L += 1;
    } else {
      a.D += 1;
      b.D += 1;
    }

    // Lady points: +1 if a lady was fielded (optional)
    if (hasLadyOnField(g, g.team1.name)) a.LP += 1;
    if (hasLadyOnField(g, g.team2.name)) b.LP += 1;
  }

  // finalize GD + points
  for (const r of map.values()) {
    r.GD = r.GF - r.GA;
    r.Pts = r.W * 3 + r.D + r.LP;
  }

  // Sort: points desc, then GD desc, then name
  return Array.from(map.values()).sort((x, y) => {
    if (y.Pts !== x.Pts) return y.Pts - x.Pts;
    if (y.GD !== x.GD) return y.GD - x.GD;
    return x.name.localeCompare(y.name);
  });
}

// ---------- UI helpers ----------
function posBarClass(pos: number) {
  if (pos >= 1 && pos <= 4) return "bg-primary/80";
  if (pos >= 5 && pos <= 8) return "bg-foreground/50";
  return "bg-transparent";
}

function formatShortDate(date: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function DashboardPage() {
  const [expanded, setExpanded] = React.useState(false);

  const upcoming = schedule.filter((g) => new Date(g.date) >= new Date());
  const nextFixture = upcoming[0] ?? schedule[0] ?? null;
  const upcomingGames = upcoming.length > 0 ? upcoming.length : schedule.length;
  const upcomingLabel =
    upcoming.length > 0 ? "Scheduled matches" : "Fixtures listed";

  const latestResult = recentScores[0] ?? null;

  const recordedMatches = recentScores.length;
  const totalMatches = schedule.length + recentScores.length;
  const recordedPct =
    totalMatches > 0 ? Math.round((recordedMatches / totalMatches) * 100) : 0;

  const table = computeTable(teams, recentScores);
  const visibleRows = expanded ? table : table.slice(0, 4);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border bg-card/80 p-6 shadow-[var(--shadow-2)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(600px_320px_at_10%_0%,hsl(var(--primary)/0.08),transparent_70%),radial-gradient(900px_320px_at_90%_0%,hsl(var(--foreground)/0.06),transparent_70%)]" />
        <div className="relative space-y-5">
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
              Latest overview
            </div>
            <h1 className="text-3xl sm:text-4xl font-headline font-semibold tracking-tight">
              The Budo League
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl">
              A Sunday league built for everyone. Clear stats, simple choices,
              and match coverage that respects how your league actually runs.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-background/70 p-4 shadow-[var(--shadow-1)]">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Teams</span>
                <Users className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold font-headline">
                {teams.length}
              </div>
              <div className="text-xs text-muted-foreground">Active clubs</div>
            </div>

            <div className="rounded-2xl border bg-background/70 p-4 shadow-[var(--shadow-1)]">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Fixtures</span>
                <Calendar className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold font-headline">
                {upcomingGames}
              </div>
              <div className="text-xs text-muted-foreground">{upcomingLabel}</div>
            </div>

            <div className="rounded-2xl border bg-background/70 p-4 shadow-[var(--shadow-1)]">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Recording</span>
                <History className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold font-headline">
                {recordedMatches}/{totalMatches || 0}
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${recordedPct}%` }}
                />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                Matches recorded so far
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-2xl">
              <Link href="/dashboard/matches">Go to matches</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href="/dashboard/fantasy">Open fantasy</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-2xl">
              <Link href="/dashboard/explore">Explore teams</Link>
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
              <div className="text-xs text-muted-foreground">
                Top {Math.min(4, table.length)} teams
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-2 pb-3">
            <Table>
              <TableHeader>
                <TableRow className="text-[11px]">
                  <TableHead className="w-[42px] pl-2 pr-1">Pos</TableHead>
                  <TableHead className="w-[140px] pr-1">Team</TableHead>
                  <TableHead className="w-[28px] px-1 text-center">PL</TableHead>
                  <TableHead className="w-[28px] px-1 text-center">W</TableHead>
                  <TableHead className="w-[32px] px-1 text-center">GD</TableHead>
                  <TableHead className="w-[32px] px-1 text-center">LP</TableHead>
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
                      <TableCell className="py-2 px-1 text-center font-mono tabular-nums">
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

            {table.length > 4 && (
              <div className="pt-3 px-2 space-y-2">
                {!expanded && (
                  <p className="text-xs text-muted-foreground">
                    Showing the top 4 teams. Expand for the full table.
                  </p>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExpanded((v) => !v)}
                  className="w-full justify-center rounded-2xl text-sm font-semibold"
                  type="button"
                >
                  {expanded ? "Hide full table" : "View full table"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-4">
          <Card className="rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-headline">
                Latest result
              </CardTitle>
            </CardHeader>
            <CardContent>
              {latestResult ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {formatShortDate(latestResult.date)} at {latestResult.venue}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {latestResult.team1.name} vs {latestResult.team2.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {latestResult.team1.shortName} -{" "}
                        {latestResult.team2.shortName}
                      </div>
                    </div>
                    <div className="shrink-0 text-lg font-bold font-mono tabular-nums">
                      {(latestResult.score1 ?? "-") + " - " + (latestResult.score2 ?? "-")}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No results recorded yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-headline">
                Next fixture
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nextFixture ? (
                <div className="space-y-3">
                  <div className="text-xs text-muted-foreground">
                    {formatShortDate(nextFixture.date)} at {nextFixture.venue}
                  </div>
                  <div className="text-sm font-semibold">
                    {nextFixture.team1.name} vs {nextFixture.team2.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Kickoff {nextFixture.time}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Fixtures will appear here once scheduled.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-headline">
                League rules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <div>Rotational subs are allowed.</div>
              <div>Matches run for 60 minutes.</div>
              <div>One lady can be fielded in the forward position.</div>
              <div>Only 3 of 8 matches are officially recorded each round.</div>
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
            {recentScores.map((g) => (
              <Link
                key={g.id}
                href={`/match/${g.id}`}
                className="flex items-center justify-between rounded-2xl border bg-card px-3 py-3 hover:bg-accent transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {formatShortDate(g.date)} at {g.venue}
                  </div>
                  <div className="truncate text-sm font-medium">
                    {g.team1.name} vs {g.team2.name}
                  </div>
                </div>
                <div className="shrink-0 text-sm font-bold font-mono tabular-nums">
                  {(g.score1 ?? "-") + " - " + (g.score2 ?? "-")}
                </div>
              </Link>
            ))}

            {recentScores.length === 0 ? (
              <div className="text-sm text-muted-foreground px-2 py-4">
                No results have been recorded yet.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
