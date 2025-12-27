"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";

import { cn } from "@/lib/utils";
import {
  schedule,
  recentScores,
  standings,
  type Team,
  type Game,
} from "@/lib/data";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/* ---------------- helpers ---------------- */

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

/* ---------------- Match row UI ---------------- */

const TEAM_NAME_CLASS =
  "text-[14px] font-semibold leading-none tracking-tight whitespace-nowrap";

type FinishedMatchProps = Pick<
  Game,
  "id" | "team1" | "team2" | "score1" | "score2" | "venue"
>;

/** EPL-style finished match row:
 * row 1:  [name] [logo] [score] [logo] [name]
 * row 2:  FT + Pitch under the score
 */
function FinishedMatchRow({
  id,
  team1,
  team2,
  score1,
  score2,
  venue,
}: FinishedMatchProps) {
  return (
    <Link href={`/match/${id}`} className="block">
      <div className="py-5 transition hover:bg-accent/10">
        <div className="flex flex-col gap-1">
          {/* row 1: names + logos + score on the same line */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-x-3">
            {/* left name */}
            <span className={cn(TEAM_NAME_CLASS, "truncate text-right")}>
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

            {/* score in the middle */}
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
            <span className={cn(TEAM_NAME_CLASS, "truncate")}>
              {team2.name}
            </span>
          </div>

          {/* row 2: FT + Pitch, centered under the score */}
          <div className="mt-1 flex flex-col items-center gap-0.5 text-[11px] text-muted-foreground">
            <span className="font-bold tracking-wide">FT</span>
            <span className="text-[10px]">{venue}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

type UpcomingMatchProps = Pick<
  Game,
  "id" | "team1" | "team2" | "date" | "time" | "status" | "venue"
>;

function UpcomingMatchRow({
  id,
  date,
  time,
  team1,
  team2,
  status,
  venue,
}: UpcomingMatchProps) {
  return (
    <Link href={`/match/${id}`} className="block">
      <div className="py-4 transition hover:bg-accent/10">
        <div className="flex flex-col gap-1">
          {/* row 1: names + logos + VS */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-x-3">
            <span className={cn(TEAM_NAME_CLASS, "truncate text-right")}>
              {team1.name}
            </span>

            <Image
              src={team1.logoUrl}
              alt={team1.name}
              width={24}
              height={24}
              className="h-6 w-6 justify-self-end rounded-full object-cover"
            />

            <span className="justify-self-center text-[16px] font-bold">
              vs
            </span>

            <Image
              src={team2.logoUrl}
              alt={team2.name}
              width={24}
              height={24}
              className="h-6 w-6 justify-self-start rounded-full object-cover"
            />

            <span className={cn(TEAM_NAME_CLASS, "truncate")}>
              {team2.name}
            </span>
          </div>

          {/* row 2: time + date */}
          <div className="mt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="tabular-nums">{time}</span>
            <span className="truncate">
              {format(new Date(date), "EEE, MMM d")}
            </span>
          </div>

          {/* row 3: status + pitch */}
          <div className="mt-0.5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <Badge variant="secondary" className="h-5 px-2 text-[10px]">
              {status.toUpperCase()}
            </Badge>
            <span>{venue}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ---------------- Table helpers ---------------- */

type TableView = "short" | "full" | "form";

function getRecentFormForTeam(
  teamId: string,
  games: Game[],
  maxGames = 5
): ("W" | "D" | "L")[] {
  const completed = games.filter(
    (g) =>
      g.status === "completed" &&
      typeof g.score1 === "number" &&
      typeof g.score2 === "number" &&
      (g.team1.id === teamId || g.team2.id === teamId)
  );

  completed.sort(
    (a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime() ||
      (b.time ?? "").localeCompare(a.time ?? "")
  );

  const form: ("W" | "D" | "L")[] = [];
  for (const g of completed.slice(0, maxGames)) {
    const isHome = g.team1.id === teamId;
    const myScore = isHome ? g.score1! : g.score2!;
    const oppScore = isHome ? g.score2! : g.score1!;
    let r: "W" | "D" | "L";
    if (myScore > oppScore) r = "W";
    else if (myScore < oppScore) r = "L";
    else r = "D";
    form.push(r);
  }
  return form;
}

const FORM_DOT_BASE =
  "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold";

/* Short table: Pos / Team / PL / W / D / GD */
function ShortTable({ data }: { data: Team[] }) {
  return (
    <Card className="rounded-2xl border-none bg-card">
      <CardContent className="px-0 pb-2 pt-0">
        <div className="mb-1 flex items-center justify-between px-4 text-[11px] uppercase text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="w-6">Pos</span>
            <span>Team</span>
          </div>
          <div className="flex items-center gap-4 tabular-nums">
            <span className="w-6 text-right">Pl</span>
            <span className="w-6 text-right">W</span>
            <span className="w-6 text-right">D</span>
            <span className="w-8 text-right">GD</span>
          </div>
        </div>

        <div className="divide-y divide-border/40">
          {data.map((t, index) => (
            <div
              key={t.id}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="w-6 text-muted-foreground tabular-nums">
                  {index + 1}
                </span>
                <Image
                  src={t.logoUrl}
                  alt={t.name}
                  width={24}
                  height={24}
                  className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
                />
                <span className="truncate font-semibold">{t.name}</span>
              </div>

              <div className="flex items-center gap-4 tabular-nums">
                <span className="w-6 text-right">{t.played ?? 0}</span>
                <span className="w-6 text-right">{t.wins}</span>
                <span className="w-6 text-right">{t.draws}</span>
                <span className="w-8 text-right">{t.gd ?? 0}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* Full table: horizontal scroll with many columns */
function FullTable({ data }: { data: Team[] }) {
  return (
    <Card className="rounded-2xl border-none bg-card">
      <CardContent className="px-0 pb-2 pt-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="border-b border-border/50 bg-background/40 text-[10px] uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Pos</th>
                <th className="px-2 py-2 text-left">Team</th>
                <th className="px-2 py-2 text-right">Pl</th>
                <th className="px-2 py-2 text-right">W</th>
                <th className="px-2 py-2 text-right">D</th>
                <th className="px-2 py-2 text-right">L</th>
                <th className="px-2 py-2 text-right">GF</th>
                <th className="px-2 py-2 text-right">GA</th>
                <th className="px-2 py-2 text-right">GD</th>
                <th className="px-2 py-2 text-right">LP</th>
                <th className="px-3 py-2 text-right">Pts</th>
                <th className="px-3 py-2 text-center">Next</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t, index) => (
                <tr key={t.id} className="border-b border-border/30 text-sm">
                  <td className="px-4 py-2 text-left tabular-nums text-muted-foreground">
                    {index + 1}
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <Image
                        src={t.logoUrl}
                        alt={t.name}
                        width={20}
                        height={20}
                        className="h-5 w-5 flex-shrink-0 rounded-full object-cover"
                      />
                      <span className="truncate font-semibold">{t.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.played ?? 0}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.wins}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.draws}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.losses}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.gf ?? 0}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.ga ?? 0}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.gd ?? 0}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {t.lp ?? 0}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold">
                    {t.pts ??
                      t.wins * 3 + t.draws + (typeof t.lp === "number" ? t.lp : 0)}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {/* placeholder for next-opponent logo */}
                    <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
                      —
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* Form table: circles W/D/L for last 5 games */
function FormTable({ data, games }: { data: Team[]; games: Game[] }) {
  return (
    <Card className="rounded-2xl border-none bg-card">
      <CardContent className="px-0 pb-2 pt-0">
        <div className="mb-1 flex items-center justify-between px-4 text-[11px] uppercase text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="w-6">Pos</span>
            <span>Team</span>
          </div>
          <span>Form</span>
        </div>

        <div className="divide-y divide-border/40">
          {data.map((t, index) => {
            const form = getRecentFormForTeam(t.id, games, 5);
            return (
              <div
                key={t.id}
                className="flex items-center justify-between px-4 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="w-6 text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <Image
                    src={t.logoUrl}
                    alt={t.name}
                    width={24}
                    height={24}
                    className="h-6 w-6 flex-shrink-0 rounded-full object-cover"
                  />
                  <span className="truncate font-semibold">{t.name}</span>
                </div>

                <div className="flex items-center gap-1">
                  {form.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      No games yet
                    </span>
                  )}
                  {form.map((r, i) => (
                    <div
                      key={i}
                      className={cn(
                        FORM_DOT_BASE,
                        r === "W" &&
                          "bg-emerald-500/90 text-emerald-50 shadow-sm",
                        r === "D" &&
                          "bg-slate-400/80 text-slate-900 shadow-sm",
                        r === "L" && "bg-rose-500/90 text-rose-50 shadow-sm"
                      )}
                    >
                      {r}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Page ---------------- */

export default function MatchesPage() {
  const allGames = React.useMemo(() => {
    const merged = [...schedule, ...recentScores];
    return merged.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, []);

  const matchweeks = React.useMemo(() => getMatchweeks(allGames), [allGames]);

  const [season, setSeason] = React.useState<Season>(seasons[0]);
  const [tab, setTab] = React.useState<"matches" | "table" | "stats">(
    "matches"
  );
  const [tableView, setTableView] = React.useState<TableView>("short");

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

  const allGamesForForm = React.useMemo(
    () => [...schedule, ...recentScores],
    []
  );

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

        {/* Tabs: Matches / Table / Stats */}
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
                      {activeDate
                        ? format(new Date(activeDate), "EEE d MMM")
                        : ""}
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
              <div className="mt-3 rounded-2xl border bg-card px-3">
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
                      finishedGames.length > 0 && "border-t border-border/40"
                    )}
                  >
                    {upcomingGames.map((g) => (
                      <UpcomingMatchRow key={g.id} {...g} />
                    ))}
                  </div>
                )}

                {finishedGames.length === 0 && upcomingGames.length === 0 && (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No matches found for this matchweek yet.
                  </div>
                )}
              </div>
            </TabsContent>

            {/* TABLE TAB */}
            <TabsContent value="table" className="mt-4">
              {/* Short / Full / Form toggle */}
              <div className="mb-3 grid grid-cols-3 rounded-2xl bg-muted p-1 text-sm font-semibold">
                {(["short", "full", "form"] as TableView[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setTableView(v)}
                    className={cn(
                      "rounded-2xl px-3 py-2 text-center capitalize transition",
                      tableView === v
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>

              {tableView === "short" && <ShortTable data={standings} />}
              {tableView === "full" && <FullTable data={standings} />}
              {tableView === "form" && (
                <FormTable data={standings} games={allGamesForForm} />
              )}
            </TabsContent>

            {/* STATS TAB (placeholder for now) */}
            <TabsContent value="stats" className="mt-4">
              <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
                Stats coming next (goals, assists, clean sheets, top clubs, etc.)
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* space so bottom nav never covers content on mobile */}
      <div className="h-24 md:hidden" />
    </div>
  );
}
