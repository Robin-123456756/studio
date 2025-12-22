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

/** ---------- helpers ---------- */

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

function pickCurrentMatchweekIndex(matchweeks: { key: string; index: number }[]) {
  const todayMs = startOfDayMs(new Date());
  const i = matchweeks.findIndex(
    (mw) => startOfDayMs(new Date(mw.key)) >= todayMs
  );
  return i === -1 ? Math.max(0, matchweeks.length - 1) : i;
}

/** ---------- UI blocks ---------- */

/** Finished match row: neat 3-column alignment like Premier League */
function FinishedMatchRow({
  id,
  venue,
  team1,
  team2,
  score1,
  score2,
}: (typeof schedule)[number]) {
  return (
    <Link href={`/match/${id}`} className="block">
      <div className="py-3">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          {/* LEFT team */}
          <div className="flex items-center justify-end gap-2 min-w-0">
            <div className="min-w-0 text-right">
              <div className="truncate text-[13px] font-semibold leading-4">
                {team1.name}
              </div>
            </div>
            <Image
              src={team1.logoUrl}
              alt={team1.name}
              width={22}
              height={22}
              className="h-[22px] w-[22px] rounded-full object-cover shrink-0"
            />
          </div>

          {/* MIDDLE score + FT */}
          <div className="flex flex-col items-center justify-center">
            <div className="min-w-[60px] rounded-md bg-muted/40 px-3 py-1 text-center">
              <span className="text-[14px] font-bold tabular-nums">
                {score1 ?? "-"} - {score2 ?? "-"}
              </span>
            </div>
            <div className="mt-1 text-[10px] font-semibold text-muted-foreground">
              FT
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">{venue}</div>
          </div>

          {/* RIGHT team */}
          <div className="flex items-center justify-start gap-2 min-w-0">
            <Image
              src={team2.logoUrl}
              alt={team2.name}
              width={22}
              height={22}
              className="h-[22px] w-[22px] rounded-full object-cover shrink-0"
            />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold leading-4">
                {team2.name}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/** Scheduled/live row: keep your old style for now */
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
      <Card className="rounded-2xl border bg-card shadow-sm transition hover:bg-accent/30">
        <CardContent className="p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Image
                  src={team1.logoUrl}
                  alt={team1.name}
                  width={26}
                  height={26}
                  className="h-[26px] w-[26px] rounded-full object-cover"
                />
                <div className="truncate text-sm font-semibold">{team1.name}</div>
              </div>
            </div>

            <div className="shrink-0 text-center">
              <div className="text-base font-bold tabular-nums">vs</div>
              <div className="mt-1 flex items-center justify-center gap-2">
                <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                  {status.toUpperCase()}
                </Badge>
                <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                  {venue}
                </Badge>
              </div>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-end gap-2">
                <div className="truncate text-sm font-semibold text-right">
                  {team2.name}
                </div>
                <Image
                  src={team2.logoUrl}
                  alt={team2.name}
                  width={26}
                  height={26}
                  className="h-[26px] w-[26px] rounded-full object-cover"
                />
              </div>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="tabular-nums">{time}</span>
            <span className="truncate">{format(new Date(date), "EEE, MMM d")}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

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
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
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

              {/* Finished matches in ONE card */}
              <div className="mt-3">
                {finishedGames.length > 0 && (
                  <Card className="rounded-2xl border bg-card shadow-sm">
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {finishedGames.map((g) => (
                          <div key={g.id} className="px-4">
                            <FinishedMatchRow {...g} />
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Upcoming matches (optional) */}
                {upcomingGames.length > 0 && (
                  <div className="mt-4 space-y-3">
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

            {/* TABLE TAB (simple preview) */}
            <TabsContent value="table" className="mt-4">
              <Card className="rounded-2xl">
                <CardContent className="p-4 space-y-3">
                  <div className="text-sm font-semibold">League Table (preview)</div>

                  <div className="space-y-2">
                    {standings.slice(0, 4).map((t, i) => (
                      <div key={t.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-5 text-muted-foreground">{i + 1}</span>
                          <Image
                            src={t.logoUrl}
                            alt={t.name}
                            width={20}
                            height={20}
                            className="h-5 w-5 rounded-full"
                          />
                          <span className="truncate font-semibold">{t.name}</span>
                        </div>

                        <span className="font-bold tabular-nums">
                          {t.wins * 3 + t.draws}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Link
                    href="/dashboard/table"
                    className="inline-flex w-full items-center justify-center rounded-2xl border bg-background px-4 py-2 text-sm font-semibold"
                  >
                    Open full table
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            {/* STATS TAB */}
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
