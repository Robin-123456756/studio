"use client";

import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Trophy, History, ChevronDown, ChevronUp } from "lucide-react";
import { teams, schedule, standings, recentScores } from "@/lib/data";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import Image from "next/image";
import { cn } from "@/lib/utils";

function getPoints(t: any) {
  // Points total includes Lady Points (LP) if present
  return t.wins * 3 + t.draws + (t.lp ?? 0);
}

export default function DashboardPage() {
  const upcomingGames = schedule.filter((g) => new Date(g.date) >= new Date()).length;

  // Top 4 by default; expand to full
  const [expanded, setExpanded] = React.useState(false);
  const visibleStandings = expanded ? standings : standings.slice(0, 4);

  return (
    <div className="space-y-8 animate-in fade-in-50">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
            <div className="text-2xl font-bold">{standings[0]?.name ?? "-"}</div>
            <p className="text-xs text-muted-foreground">
              {standings[0] ? `${getPoints(standings[0])} points` : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Standings + Recent results */}
      <div className="grid gap-8 md:grid-cols-2">
        {/* ✅ MOBILE-FIRST TABLE STANDINGS */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle>League Standings</CardTitle>
          </CardHeader>

          <CardContent className="p-0">
            {/* header row (mobile-fit, no horizontal scroll) */}
            <div className="px-4 pb-2">
              <div className="grid grid-cols-[44px_1fr_28px_28px_34px_34px_42px] items-center text-[11px] text-muted-foreground">
                <div>Pos</div>
                <div>Team</div>
                <div className="text-right">PL</div>
                <div className="text-right">W</div>
                <div className="text-right">GD</div>
                <div className="text-right">LP</div>
                <div className="text-right">Pts</div>
              </div>
            </div>

            <div className="divide-y">
              {visibleStandings.map((t, idx) => {
                const pos = idx + 1; // because visibleStandings is sliced from already sorted standings
                const pl = t.wins + t.draws + t.losses;
                const gd = t.gd ?? 0;
                const lp = t.lp ?? 0;
                const pts = getPoints(t);

                // highlight bars: 1-4 blue, 5-8 orange (only visible when expanded)
                const barClass =
                  pos <= 4 ? "bg-blue-600" : pos >= 5 && pos <= 8 ? "bg-orange-500" : "bg-transparent";

                return (
                  <div key={t.id} className="px-4 py-3">
                    <div className="grid grid-cols-[44px_1fr_28px_28px_34px_34px_42px] items-center">
                      {/* position + highlight bar */}
                      <div className="flex items-center gap-2">
                        <div className={cn("h-8 w-1.5 rounded-full", barClass)} />
                        <div className="w-6 text-sm font-semibold tabular-nums">{pos}</div>
                      </div>

                      {/* team */}
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-muted">
                          <Image
                            src={t.logoUrl}
                            alt={t.name}
                            fill
                            className="object-cover"
                            sizes="28px"
                          />
                        </div>
                        <div className="truncate text-sm font-semibold">{t.name}</div>
                      </div>

                      {/* stats */}
                      <div className="text-right text-sm tabular-nums">{pl}</div>
                      <div className="text-right text-sm tabular-nums">{t.wins}</div>
                      <div className="text-right text-sm tabular-nums">{gd}</div>
                      <div className="text-right text-sm tabular-nums">{lp}</div>
                      <div className="text-right text-sm font-bold tabular-nums">{pts}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* expand/collapse */}
            {standings.length > 4 && (
              <div className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-xl border px-3 py-2",
                    "text-sm font-medium hover:bg-accent transition-colors"
                  )}
                >
                  <span>{expanded ? "Show top 4 only" : "View full table"}</span>
                  {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Recent Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {recentScores.map((game) => (
                  <TableRow key={game.id}>
                    <TableCell className="w-20">{format(new Date(game.date), "MMM d")}</TableCell>
                    <TableCell>
                      {game.team1.name} vs {game.team2.name}
                    </TableCell>
                    <TableCell className="text-right font-mono font-bold">
                      {game.score1} - {game.score2}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell>5d ago</TableCell>
                  <TableCell>New rule about substitutions added.</TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
