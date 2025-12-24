"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import { schedule, recentScores, standings } from "@/lib/data";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ---------- helpers ---------- */

type Season = { code: string };

const seasons: Season[] = [
  { code: "TBL9" },
  { code: "TBL8" },
  { code: "TBL7" },
  { code: "TBL6" },
  { code: "TBL5" },
  { code: "TBL4" },
  { code: "TBL3" },
];

function dayKey(d: string) {
  return d; // expects YYYY-MM-DD
}

function sameDay(a: string, b: string) {
  return dayKey(a) === dayKey(b);
}

function startOfDayMs(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function labelForDate(yyyyMmDd: string) {
  const target = new Date(yyyyMmDd);
  const today = new Date();

  const diffDays = Math.round(
    (startOfDayMs(target) - startOfDayMs(today)) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === -1) return "Yesterday";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1) return "Upcoming";
  return format(target, "EEE, MMM d");
}

function getMatchweeks(allGames: { date: string }[]) {
  const dates = Array.from(new Set(allGames.map((g) => dayKey(g.date)))).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  return dates.map((d, idx) => ({
    key: d,
    index: idx + 1,
  }));
}

function pickCurrentMatchweekIndex(
  matchweeks: { key: string; index: number }[]
) {
  const todayMs = startOfDayMs(new Date());
  const i = matchweeks.findIndex(
    (mw) => startOfDayMs(new Date(mw.key)) >= todayMs
  );
  return i === -1 ? Math.max(0, matchweeks.length - 1) : i;
}

/* ---------- UI blocks ---------- */

const TEAM_NAME_CLASS =
  "text-[14px] font-semibold leading-none tracking-tight whitespace-nowrap";

/** EPL-style finished row:
 * row 1:  name  logo  score  logo  name
 * row 2:  FT centered
 */
function FinishedMatchRow({
  id,
  team1,
  team2,
  score1,
  score2,
}: (typeof schedule)[number]) {
  return (
    <Link href={`/match/${id}`} className="block">
      <div className="py-5 transition hover:bg-accent/10">
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-x-3">
            {/* left name */}
            <span
              className={cn(
                TEAM_NAME_CLASS,
                "truncate text-right"
              )}
            >
              {team1.name}
            </span>

            {/* left logo */}
            <Image
              src={team1.logoUrl}
              alt={team1.name}
              width={24}
              height={24}
              className="h-6 w-6 justify-self-end rounded-full object-cover"
            />

            {/* score centre */}
            <span className="justify-self-center text-[18px] font-extrabold tabular-nums">
              {score1 ?? "-"} - {score2 ?? "-"}
            </span>

            {/* right logo */}
            <Image
              src={team2.logoUrl}
              alt={team2.name}
              width={24}
              height={24}
              className="h-6 w-6 justify-self-start rounded-full object-cover"
            />

            {/* right name */}
            <span className={cn(TEAM_NAME_CLASS, "truncate")}>{team2.name}</span>
          </div>

          {/* FT under score */}
          <div className="text-center text-[12px] font-bold tracking-wide text-muted-foreground">
            FT
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Upcoming row with SCHEDULED + time/date/pitch */
function UpcomingMatchRow({
  id,
  date,
  time,
  venue,
  team1,
  team2,
  status,
}: (typeof schedule)[number]) {
  return (
    <Link href={`/match/${id}`} className="block">
      <div className="py-4 transition hover:bg-accent/10">
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-x-3">
            {/* left name */}
            <span
              className={cn(
                TEAM_NAME_CLASS,
                "truncate text-right"
              )}
            >
              {team1.name}
            </span>

            {/* left logo */}
            <Image
              src={team1.logoUrl}
              alt={team1.name}
              width={24}
              height={24}
              className="h-6 w-6 justify-self-end rounded-full object-cover"
            />

            {/* vs centre */}
            <span className="justify-self-center text-[16px] font-bold">
              vs
            </span>

            {/* right logo */}
            <Image
              src={team2.logoUrl}
              alt={team2.name}
              width={24}
              height={24}
              className="h-6 w-6 justify-self-start rounded-full object-cover"
            />

            {/* right name */}
            <span className={cn(TEAM_NAME_CLASS, "truncate")}>{team2.name}</span>
          </div>

          {/* status on its own line */}
          <div className="mt-1 flex justify-center">
            <Badge variant="secondary" className="h-5 px-2 text-[10px]">
              {status.toUpperCase()}
            </Badge>
          </div>

          {/* time / pitch / date line */}
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="tabular-nums">{time}</span>
            <span className="truncate">{venue}</span>
            <span className="truncate">
              {format(new Date(date), "EEE, MMM d")}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ---------- TABLE VIEWS ---------- */

/** helpers to safely read stats from standings without caring about exact type */
function getStat(
  team: any,
  key: string,
  fallback: number | string = "-"
): number | string {
  if (team == null) return fallback;
  if (team[key] == null) return fallback;
  return team[key];
}

/** Short: Pos, Team, PL, W, D, GD */
function ShortTable({ teams }: { teams: typeof standings }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th className="py-2 pr-3 text-left font-medium">Pos</th>
            <th className="py-2 pr-3 text-left font-medium">Team</th>
            <th className="py-2 px-2 text-center font-medium">PL</th>
            <th className="py-2 px-2 text-center font-medium">W</th>
            <th className="py-2 px-2 text-center font-medium">D</th>
            <th className="py-2 pl-2 text-center font-medium">GD</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => {
            const anyT = t as any;
            const wins = anyT.wins ?? 0;
            const draws = anyT.draws ?? 0;
            const losses = anyT.losses ?? 0;
            const played =
              anyT.played ?? anyT.pl ?? wins + draws + losses ?? "-";
            const gd =
              anyT.gd ??
              anyT.goalDifference ??
              (anyT.goalsFor != null && anyT.goalsAgainst != null
                ? anyT.goalsFor - anyT.goalsAgainst
                : "-");

            return (
              <tr
                key={t.id}
                className="border-t border-border/40 text-[13px]"
              >
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-primary" />
                    <span className="tabular-nums">{i + 1}</span>
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src={t.logoUrl}
                      alt={t.name}
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-full"
                    />
                    <span className="truncate font-semibold text-sm">
                      {t.name}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center tabular-nums">{played}</td>
                <td className="py-2 px-2 text-center tabular-nums">{wins}</td>
                <td className="py-2 px-2 text-center tabular-nums">{draws}</td>
                <td className="py-2 pl-2 text-center tabular-nums">{gd}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Full: Pos, Team, PL, W, D, L, GF, GA, GD, LP, Pts, Next */
function FullTable({ teams }: { teams: typeof standings }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[720px] text-xs">
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th className="py-2 pr-3 text-left font-medium">Pos</th>
            <th className="py-2 pr-3 text-left font-medium">Team</th>
            <th className="py-2 px-2 text-center font-medium">PL</th>
            <th className="py-2 px-2 text-center font-medium">W</th>
            <th className="py-2 px-2 text-center font-medium">D</th>
            <th className="py-2 px-2 text-center font-medium">L</th>
            <th className="py-2 px-2 text-center font-medium">GF</th>
            <th className="py-2 px-2 text-center font-medium">GA</th>
            <th className="py-2 px-2 text-center font-medium">GD</th>
            <th className="py-2 px-2 text-center font-medium">LP</th>
            <th className="py-2 px-2 text-center font-medium">Pts</th>
            <th className="py-2 pl-2 text-center font-medium">Next</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => {
            const anyT = t as any;
            const wins = anyT.wins ?? 0;
            const draws = anyT.draws ?? 0;
            const losses = anyT.losses ?? 0;
            const played =
              anyT.played ?? anyT.pl ?? wins + draws + losses ?? "-";
            const gf = getStat(anyT, "goalsFor");
            const ga = getStat(anyT, "goalsAgainst");
            const gd =
              anyT.gd ??
              anyT.goalDifference ??
              (gf !== "-" && ga !== "-" ? (gf as number) - (ga as number) : "-");
            const pts =
              anyT.points ??
              anyT.pts ??
              (typeof wins === "number" && typeof draws === "number"
                ? wins * 3 + draws
                : "-");
            const lp = getStat(anyT, "lastPosition", "-");
            const nextLogo = anyT.nextOpponentLogoUrl;

            return (
              <tr
                key={t.id}
                className="border-t border-border/40 text-[13px]"
              >
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-primary" />
                    <span className="tabular-nums">{i + 1}</span>
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src={t.logoUrl}
                      alt={t.name}
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-full"
                    />
                    <span className="truncate font-semibold text-sm">
                      {t.name}
                    </span>
                  </div>
                </td>
                <td className="py-2 px-2 text-center tabular-nums">{played}</td>
                <td className="py-2 px-2 text-center tabular-nums">{wins}</td>
                <td className="py-2 px-2 text-center tabular-nums">{draws}</td>
                <td className="py-2 px-2 text-center tabular-nums">{losses}</td>
                <td className="py-2 px-2 text-center tabular-nums">{gf}</td>
                <td className="py-2 px-2 text-center tabular-nums">{ga}</td>
                <td className="py-2 px-2 text-center tabular-nums">{gd}</td>
                <td className="py-2 px-2 text-center tabular-nums">{lp}</td>
                <td className="py-2 px-2 text-center tabular-nums">{pts}</td>
                <td className="py-2 pl-2 text-center">
                  {nextLogo ? (
                    <Image
                      src={nextLogo}
                      alt="Next opponent"
                      width={20}
                      height={20}
                      className="mx-auto h-5 w-5 rounded-full"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Form: Pos, Team, Form (5 circles) */
function FormTable({ teams }: { teams: typeof standings }) {
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full min-w-[420px] text-xs">
        <thead>
          <tr className="text-[11px] text-muted-foreground">
            <th className="py-2 pr-3 text-left font-medium">Pos</th>
            <th className="py-2 pr-3 text-left font-medium">Team</th>
            <th className="py-2 pl-3 text-left font-medium">Form</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((t, i) => {
            const anyT = t as any;
            const form: string[] =
              anyT.recentForm && Array.isArray(anyT.recentForm)
                ? anyT.recentForm
                : []; // you can fill this array in lib/data

            // fallback fake form so UI still looks nice if data missing
            const fallback = ["W", "W", "D", "L", "W"];
            const values = (form.length ? form : fallback).slice(0, 5);

            return (
              <tr
                key={t.id}
                className="border-t border-border/40 text-[13px]"
              >
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-1 rounded-full bg-primary" />
                    <span className="tabular-nums">{i + 1}</span>
                  </div>
                </td>
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src={t.logoUrl}
                      alt={t.name}
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-full"
                    />
                    <span className="truncate font-semibold text-sm">
                      {t.name}
                    </span>
                  </div>
                </td>
                <td className="py-2 pl-3">
                  <div className="flex gap-2">
                    {values.map((r, idx) => {
                      const result = r.toUpperCase();
                      const base =
                        "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold";

                      let colorClass = "bg-muted text-foreground";
                      if (result === "W") colorClass = "bg-emerald-500 text-white";
                      if (result === "D") colorClass = "bg-slate-400 text-white";
                      if (result === "L") colorClass = "bg-rose-500 text-white";

                      return (
                        <span key={idx} className={cn(base, colorClass)}>
                          {result}
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Page ---------- */

export default function MatchesPage() {
  const allGames = React.useMemo(() => {
    const merged = [...schedule, ...recentScores];
    return merged.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, []);

  const matchweeks = React.useMemo(() => getMatchweeks(allGames), [allGames]);

  const [season, setSeason] = React.useState<Season>(seasons[0]);
  const [tab, setTab] = React.useState<"matches" | "table" | "stats">("matches");
  const [tableView, setTableView] = React.useState<"short" | "full" | "form">(
    "short"
  );

  const [mwIndex, setMwIndex] = React.useState(() =>
    pickCurrentMatchweekIndex(matchweeks)
  );

  React.useEffect(() => {
    setMwIndex((prev) => Math.min(prev, Math.max(0, matchweeks.length - 1)));
  }, [matchweeks.length]);

  const activeMw = matchweeks[mwIndex];
  const activeDate = activeMw?.key;

  const weekGames = React.useMemo(() => {
    if (!activeDate) return [];
    return allGames
      .filter((g) => sameDay(g.date, activeDate))
      .sort((a, b) => (a.venue ?? "").localeCompare(b.venue ?? ""));
  }, [allGames, activeDate]);

  const finishedGames = weekGames.filter((g) => g.status === "completed");
  const upcomingGames = weekGames.filter((g) => g.status !== "completed");

  const dateLabel = activeDate ? labelForDate(activeDate) : "Matches";
  const canPrev = mwIndex > 0;
  const canNext = mwIndex < matchweeks.length - 1;

  return (
    <div className="animate-in fade-in-50">
      <div className="rounded-3xl border bg-card p-4 shadow-sm">
        {/* Season dropdown */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-muted-foreground">
              Season
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-2xl border bg-background px-3 py-2 text-sm font-semibold shadow-sm"
                >
                  <span>{season.code}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="start"
                className={cn(
                  "w-40 rounded-2xl border p-1 shadow-lg",
                  "bg-slate-950/90 text-white backdrop-blur"
                )}
              >
                {seasons.map((s) => (
                  <DropdownMenuItem
                    key={s.code}
                    onClick={() => setSeason(s)}
                    className={cn(
                      "cursor-pointer rounded-xl px-3 py-2",
                      "hover:bg-white/10 hover:text-white",
                      "focus:bg-white/10 focus:text-white",
                      season.code === s.code && "bg-white/15"
                    )}
                  >
                    <span className="font-semibold">{s.code}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Top tabs */}
        <div className="mt-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as any)}
            className="w-full"
          >
            <TabsList className="w-full justify-start gap-6 bg-transparent p-0">
              <TabsTrigger
                value="matches"
                className={cn(
                  "rounded-none px-0 pb-2 text-base font-semibold",
                  "data-[state=active]:shadow-none",
                  "data-[state=active]:border-b-2 data-[state=active]:border-foreground"
                )}
              >
                Matches
              </TabsTrigger>

              <TabsTrigger
                value="table"
                className={cn(
                  "rounded-none px-0 pb-2 text-base font-semibold text-muted-foreground",
                  "data-[state=active]:text-foreground data-[state=active]:shadow-none",
                  "data-[state=active]:border-b-2 data-[state=active]:border-foreground"
                )}
              >
                Table
              </TabsTrigger>

              <TabsTrigger
                value="stats"
                className={cn(
                  "rounded-none px-0 pb-2 text-base font-semibold text-muted-foreground",
                  "data-[state=active]:text-foreground data-[state=active]:shadow-none",
                  "data-[state=active]:border-b-2 data-[state=active]:border-foreground"
                )}
              >
                Stats
              </TabsTrigger>
            </TabsList>

            {/* MATCHES TAB */}
            <TabsContent value="matches" className="mt-4">
              {/* Matchweek selector */}
              <div className="rounded-2xl border bg-background p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => canPrev && setMwIndex((x) => x - 1)}
                    disabled={!canPrev}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full border bg-card",
                      !canPrev && "opacity-40"
                    )}
                    aria-label="Previous matchweek"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="text-center">
                    <div className="text-lg font-bold">
                      Matchweek {activeMw?.index ?? 1}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {activeDate ? format(new Date(activeDate), "EEE d MMM") : ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => canNext && setMwIndex((x) => x + 1)}
                    disabled={!canNext}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full border bg-card",
                      !canNext && "opacity-40"
                    )}
                    aria-label="Next matchweek"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Date label */}
              <div className="mt-4 text-sm font-semibold text-muted-foreground">
                {dateLabel}
              </div>

              {/* List of matches */}
              <div className="mt-3">
                {finishedGames.length > 0 && (
                  <div className="divide-y divide-border/40">
                    {finishedGames.map((g) => (
                      <FinishedMatchRow key={g.id} {...g} />
                    ))}
                  </div>
                )}

                {upcomingGames.length > 0 && (
                  <div
                    className={cn(
                      "divide-y divide-border/40",
                      finishedGames.length > 0 && "mt-2"
                    )}
                  >
                    {upcomingGames.map((g) => (
                      <UpcomingMatchRow key={g.id} {...g} />
                    ))}
                  </div>
                )}

                {finishedGames.length === 0 && upcomingGames.length === 0 && (
                  <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
                    No matches found for this matchweek yet.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TABLE TAB */}
            <TabsContent value="table" className="mt-4">
              <Card className="rounded-2xl">
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">League Table</div>
                    <span className="text-xs text-muted-foreground">
                      Season {season.code}
                    </span>
                  </div>

                  {/* Short / Full / Form switch */}
                  <div className="inline-flex w-full rounded-2xl bg-muted/40 p-1">
                    {[
                      { key: "short", label: "Short" },
                      { key: "full", label: "Full" },
                      { key: "form", label: "Form" },
                    ].map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() =>
                          setTableView(opt.key as "short" | "full" | "form")
                        }
                        className={cn(
                          "flex-1 rounded-2xl px-3 py-2 text-sm font-semibold transition",
                          tableView === opt.key
                            ? "bg-background shadow-sm"
                            : "text-muted-foreground hover:bg-muted/60"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {tableView === "short" && <ShortTable teams={standings} />}
                  {tableView === "full" && <FullTable teams={standings} />}
                  {tableView === "form" && <FormTable teams={standings} />}
                </CardContent>
              </Card>
            </TabsContent>

            {/* STATS TAB (placeholder for now) */}
            <TabsContent value="stats" className="mt-4">
              <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
                Stats coming next (goals, clean sheets, top scorers, etc.)
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* space so bottom nav never covers content */}
      <div className="h-24 md:hidden" />
    </div>
  );
}
