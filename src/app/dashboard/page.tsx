"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Users, Calendar, Trophy, History, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

import { teams, schedule, standings, recentScores } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function PosPill({ pos }: { pos: number }) {
  const inTop4 = pos <= 4;
  const in5to8 = pos >= 5 && pos <= 8;

  return (
    <div
      className={[
        "grid h-7 w-7 place-items-center rounded-md text-xs font-bold tabular-nums",
        inTop4 ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30" : "",
        in5to8 ? "bg-sky-500/20 text-sky-300 ring-1 ring-sky-500/30" : "",
        !inTop4 && !in5to8 ? "bg-muted text-foreground/80" : "",
      ].join(" ")}
      aria-label={`Position ${pos}`}
      title={`Position ${pos}`}
    >
      {pos}
    </div>
  );
}

function MiniStandingsTable() {
  const [expanded, setExpanded] = React.useState(false);

  const visible = expanded ? standings : standings.slice(0, 4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">League Table</CardTitle>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <span className="text-xs font-medium text-muted-foreground">
              {expanded ? "Show less" : "Show more"}
            </span>
            {expanded ? <ChevronUp className="ml-1 h-4 w-4" /> : <ChevronDown className="ml-1 h-4 w-4" />}
          </Button>
        </div>

        {/* Column labels (compact, phone-friendly) */}
        <div className="grid grid-cols-[40px_1fr_36px_44px_36px_44px] items-center px-2 text-[11px] font-semibold text-muted-foreground">
          <div className="text-left">POS</div>
          <div className="text-left">TEAM</div>
          <div className="text-center">W</div>
          <div className="text-center">GD</div>
          <div className="text-center">LP</div>
          <div className="text-right">PTS</div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="divide-y divide-border rounded-xl border bg-card">
          {visible.map((team, idx) => {
            const pos = expanded ? idx + 1 : idx + 1; // still correct because we slice from top
            const pts = team.pts ?? team.wins * 3 + team.draws + (team.lp ?? 0);
            const gd = team.gd ?? 0;
            const lp = team.lp ?? 0;

            return (
              <div
                key={team.id}
                className="grid grid-cols-[40px_1fr_36px_44px_36px_44px] items-center px-2 py-2"
              >
                <div className="flex items-center justify-start">
                  <PosPill pos={pos} />
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  <Image
                    src={team.logoUrl}
                    alt={team.name}
                    width={22}
                    height={22}
                    className="h-[22px] w-[22px] rounded-full object-cover"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium leading-5">{team.name}</div>
                  </div>
                </div>

                <div className="text-center text-sm font-semibold tabular-nums">{team.wins}</div>
                <div className="text-center text-sm font-semibold tabular-nums">{gd}</div>
                <div className="text-center text-sm font-semibold tabular-nums">{lp}</div>
                <div className="text-right text-sm font-bold tabular-nums">{pts}</div>
              </div>
            );
          })}
        </div>

        {/* Optional: quick link to full table page if you have it */}
        <div className="mt-3 flex justify-end">
          <Link href="/dashboard/table" className="text-xs font-medium text-primary hover:underline">
            View full table
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const upcomingGames = schedule.filter((g) => new Date(g.date) >= new Date()).length;

  const top = standings[0];
  const topPts = top?.pts ?? (top ? top.wins * 3 + top.draws + (top.lp ?? 0) : 0);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      {/* Summary cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Team</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{top?.name ?? "—"}</div>
            <p className="text-xs text-muted-foreground">{top ? `${topPts} pts` : "No matches yet"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Replace graph card with mobile standings table */}
      <div className="grid gap-6 md:grid-cols-2">
        <MiniStandingsTable />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" /> Recent Results
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="divide-y divide-border rounded-xl border bg-card">
              {recentScores.map((game) => (
                <Link
                  key={game.id}
                  href={`/match/${game.id}`}
                  className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-accent/40"
                >
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {format(new Date(game.date), "MMM d")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {game.team1.name} vs {game.team2.name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{game.venue}</div>
                  </div>

                  <div className="text-sm font-bold tabular-nums">
                    {game.score1} – {game.score2}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
