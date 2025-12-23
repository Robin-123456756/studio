"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronUp, Users, Calendar, Trophy, History } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const side1 = game.team1.name === teamName ? game.onField1?.players : undefined;
  const side2 = game.team2.name === teamName ? game.onField2?.players : undefined;

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

  const completed = games.filter((g) => g.status === "completed" && typeof g.score1 === "number" && typeof g.score2 === "number");

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
    r.Pts = r.W * 3 + r.D + r.LP; // ✅ LP contributes even if team loses/wins
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
  // 1–4 blue, 5–8 orange, else transparent
  if (pos >= 1 && pos <= 4) return "bg-blue-500";
  if (pos >= 5 && pos <= 8) return "bg-orange-500";
  return "bg-transparent";
}

export default function DashboardPage() {
  const [expanded, setExpanded] = React.useState(false);

  const upcomingGames = schedule.filter((g) => new Date(g.date) >= new Date()).length;

  // Build table from completed games you have (recentScores)
  // If later you add more completed games, it will automatically update.
  const table = computeTable(teams, recentScores);

  const visibleRows = expanded ? table : table.slice(0, 4);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {/* Summary cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teams.length}</div>
            <p className="text-xs text-muted-foreground">Currently in the league</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Games</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingGames}</div>
            <p className="text-xs text-muted-foreground">Scheduled matches</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Team</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{table[0]?.name ?? "—"}</div>
            <p className="text-xs text-muted-foreground">{table[0]?.Pts ?? 0} points</p>
          </CardContent>
        </Card>
      </div>

      {/* ✅ Replace the graph with a proper MOBILE table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">League Table</CardTitle>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className="gap-1"
              type="button"
            >
              {expanded ? (
                <>
                  Hide <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  Show more <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="px-2 pb-3">
          {/* No horizontal scroll: we keep columns tight */}
          <Table>
            <TableHeader>
              <TableRow className="text-[11px]">
                <TableHead className="w-[54px]">Pos</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="w-[34px] text-center">PL</TableHead>
                <TableHead className="w-[34px] text-center">W</TableHead>
                <TableHead className="w-[42px] text-center">GD</TableHead>
                <TableHead className="w-[40px] text-center">LP</TableHead>
                <TableHead className="w-[44px] text-right">Pts</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {visibleRows.map((r, idx) => {
                const pos = idx + 1;
                const bar = posBarClass(pos);

                return (
                  <TableRow key={r.teamId} className="text-[12px]">
                    <TableCell className="py-3">
                      <div className="flex items-center gap-2">
                        <div className={`h-6 w-1.5 rounded-full ${bar}`} />
                        <span className="font-semibold tabular-nums">{pos}</span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Image
                          src={r.logoUrl}
                          alt={r.name}
                          width={20}
                          height={20}
                          className="rounded-full shrink-0"
                        />
                        <span className="truncate font-medium">{r.name}</span>
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-center font-mono tabular-nums">{r.PL}</TableCell>
                    <TableCell className="py-3 text-center font-mono tabular-nums">{r.W}</TableCell>
                    <TableCell className="py-3 text-center font-mono tabular-nums">{r.GD}</TableCell>
                    <TableCell className="py-3 text-center font-mono tabular-nums">{r.LP}</TableCell>
                    <TableCell className="py-3 text-right font-mono font-bold tabular-nums">{r.Pts}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {!expanded && table.length > 4 && (
            <div className="pt-2 text-xs text-muted-foreground px-2">
              Showing top 4. Tap <span className="font-medium">Show more</span> to view the full table.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Results (keep it, it’s useful on mobile) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" /> Recent Results
          </CardTitle>
        </CardHeader>
        <CardContent className="px-2">
          <div className="space-y-2">
            {recentScores.map((g) => (
              <Link
                key={g.id}
                href={`/match/${g.id}`}
                className="flex items-center justify-between rounded-xl border bg-card px-3 py-3 hover:bg-accent transition-colors"
              >
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {new Date(g.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })} • {g.venue}
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
