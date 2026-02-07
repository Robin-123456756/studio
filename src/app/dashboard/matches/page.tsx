"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";

/* ---------------- types ---------------- */

type ApiGameweek = {
  id: number;
  name: string | null;
  deadline_time: string | null;
  finalized?: boolean | null;
  is_current?: boolean | null;
};

type ApiTeam = {
  team_uuid: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};

type ApiMatch = {
  id: number;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean;
  is_final: boolean;
  home_team_uuid: string;
  away_team_uuid: string;
  home_team: ApiTeam | null;
  away_team: ApiTeam | null;
};

type UiTeam = { id: string; name: string; logoUrl: string };
type UiGame = {
  id: string;
  date: string;
  time: string;
  kickoffIso: string | null;
  status: "completed" | "scheduled";
  team1: UiTeam;
  team2: UiTeam;
  score1?: number | null;
  score2?: number | null;
  isFinal?: boolean;
};

type StandingsRow = {
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

type StatPlayer = {
  id: string;
  playerId: string;
  gameweekId: number;
  points: number;
  goals: number;
  assists: number;
  cleanSheet: boolean;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  playerName: string;
  player: {
    name: string;
    teamName: string | null;
    teamShort: string | null;
  } | null;
};

/* ---------------- helpers ---------------- */

function formatDateHeading(yyyyMmDd: string) {
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "Africa/Kampala",
  }).format(d);
}

function toUgTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  })
    .format(new Date(iso))
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

function groupByDate(games: UiGame[]) {
  const map = new Map<string, UiGame[]>();
  for (const g of games) {
    const arr = map.get(g.date) ?? [];
    arr.push(g);
    map.set(g.date, arr);
  }
  return Array.from(map.entries()).sort(
    (a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()
  );
}

function toUgDateKey(iso: string) {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kampala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  const da = parts.find((p) => p.type === "day")?.value ?? "00";
  return `${y}-${m}-${da}`;
}

function mapApiMatchToUi(m: ApiMatch): UiGame {
  const homeName = m.home_team?.name ?? "Home";
  const awayName = m.away_team?.name ?? "Away";
  const kickoffIso = m.kickoff_time ?? null;

  return {
    id: String(m.id),
    date: kickoffIso ? toUgDateKey(kickoffIso) : "0000-00-00",
    time: kickoffIso ? toUgTime(kickoffIso) : "—",
    kickoffIso,
    status: m.is_played ? "completed" : "scheduled",
    team1: {
      id: m.home_team_uuid,
      name: homeName,
      logoUrl: m.home_team?.logo_url ?? "/placeholder-team.png",
    },
    team2: {
      id: m.away_team_uuid,
      name: awayName,
      logoUrl: m.away_team?.logo_url ?? "/placeholder-team.png",
    },
    score1: m.home_goals,
    score2: m.away_goals,
    isFinal: m.is_final,
  };
}

function posBarClass(pos: number) {
  if (pos >= 1 && pos <= 4) return "bg-primary/80";
  if (pos >= 5 && pos <= 8) return "bg-foreground/50";
  return "bg-transparent";
}

/* ---------------- FPL-ish list row ---------------- */

function MatchRow({ g }: { g: UiGame }) {
  const showScore = g.status === "completed";

  return (
    <div className="py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_28px_72px_28px_minmax(0,1fr)] items-center gap-x-3">
        <div className="min-w-0 text-right">
          <div className="truncate text-[14px] font-semibold leading-none">
            {g.team1.name}
          </div>
        </div>

        <div className="h-7 w-7 justify-self-end rounded-full bg-muted overflow-hidden">
          <Image
            src={g.team1.logoUrl}
            alt={g.team1.name}
            width={28}
            height={28}
            className="h-7 w-7 object-cover"
          />
        </div>

        <div className="text-center">
          {showScore ? (
            <>
              <div className="font-mono text-[16px] font-extrabold tabular-nums">
                {g.score1 ?? 0} - {g.score2 ?? 0}
              </div>
              <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                {g.isFinal ? "FT" : "Played"}
              </div>
            </>
          ) : (
            <div className="text-[16px] font-extrabold tabular-nums">
              {g.time}
            </div>
          )}
        </div>

        <div className="h-7 w-7 justify-self-start rounded-full bg-muted overflow-hidden">
          <Image
            src={g.team2.logoUrl}
            alt={g.team2.name}
            width={28}
            height={28}
            className="h-7 w-7 object-cover"
          />
        </div>

        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold leading-none">
            {g.team2.name}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */

export default function MatchesPage() {
  const [tab, setTab] = React.useState<"matches" | "table" | "stats">("matches");

  const [allGws, setAllGws] = React.useState<ApiGameweek[]>([]);
  const [gwId, setGwId] = React.useState<number | null>(null);

  const [games, setGames] = React.useState<UiGame[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Table + Stats state
  const [standings, setStandings] = React.useState<StandingsRow[]>([]);
  const [standingsLoading, setStandingsLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);

  const [statsData, setStatsData] = React.useState<StatPlayer[]>([]);
  const [statsLoading, setStatsLoading] = React.useState(true);

  // Gameweeks that have started (deadline passed) — sorted by id
  const startedGwIds = React.useMemo(() => {
    const now = Date.now();
    return allGws
      .filter((g) => {
        if (g.finalized) return true;
        const dl = g.deadline_time ? new Date(g.deadline_time).getTime() : NaN;
        return Number.isFinite(dl) && dl <= now;
      })
      .map((g) => g.id)
      .sort((a, b) => a - b);
  }, [allGws]);

  // Load gameweeks and default to latest started
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load gameweeks");

        const all: ApiGameweek[] = json.all ?? [];
        setAllGws(all);

        // Default to the latest gameweek whose deadline has passed
        const now = Date.now();
        const started = all
          .filter((g) => {
            if (g.finalized) return true;
            const dl = g.deadline_time ? new Date(g.deadline_time).getTime() : NaN;
            return Number.isFinite(dl) && dl <= now;
          })
          .sort((a, b) => a.id - b.id);

        const defaultGw = started.length > 0
          ? started[started.length - 1].id
          : json.current?.id ?? json.next?.id ?? null;

        setGwId(defaultGw);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load gameweeks");
      }
    })();
  }, []);

  // Fetch matches for gwId
  React.useEffect(() => {
    if (!gwId) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/matches?gw_id=${gwId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load matches");

        const mapped = (json.matches as ApiMatch[]).map(mapApiMatchToUi);
        setGames(mapped);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load matches");
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [gwId]);

  // Fetch standings
  React.useEffect(() => {
    (async () => {
      try {
        setStandingsLoading(true);
        const res = await fetch("/api/standings", { cache: "no-store" });
        const json = await res.json();
        if (res.ok) setStandings(json.rows ?? []);
      } catch {
        // silent
      } finally {
        setStandingsLoading(false);
      }
    })();
  }, []);

  // Fetch player stats for current GW
  React.useEffect(() => {
    if (!gwId) return;
    (async () => {
      try {
        setStatsLoading(true);
        const res = await fetch(`/api/player-stats?gw_id=${gwId}`, { cache: "no-store" });
        const json = await res.json();
        if (res.ok) setStatsData(json.stats ?? []);
      } catch {
        // silent
      } finally {
        setStatsLoading(false);
      }
    })();
  }, [gwId]);

  const activeGw = allGws.find((g) => g.id === gwId);
  const activeName = activeGw?.name ?? (gwId ? `Match day ${gwId}` : "Match day —");

  const currentIdx = startedGwIds.indexOf(gwId ?? -1);
  const canPrev = currentIdx > 0;
  const canNext = currentIdx >= 0 && currentIdx < startedGwIds.length - 1;

  const visibleRows = expanded ? standings : standings.slice(0, 8);

  // Aggregate stats: top scorers + top assists from fetched player stats
  const scorerMap = new Map<string, { name: string; goals: number; team: string }>();
  const assistMap = new Map<string, { name: string; assists: number; team: string }>();
  for (const s of statsData) {
    const name = s.playerName;
    const team = s.player?.teamShort ?? s.player?.teamName ?? "—";
    if (s.goals > 0) {
      const existing = scorerMap.get(s.playerId);
      scorerMap.set(s.playerId, {
        name,
        goals: (existing?.goals ?? 0) + s.goals,
        team,
      });
    }
    if (s.assists > 0) {
      const existing = assistMap.get(s.playerId);
      assistMap.set(s.playerId, {
        name,
        assists: (existing?.assists ?? 0) + s.assists,
        team,
      });
    }
  }
  const topScorers = [...scorerMap.values()].sort((a, b) => b.goals - a.goals).slice(0, 5);
  const topAssists = [...assistMap.values()].sort((a, b) => b.assists - a.assists).slice(0, 5);

  return (
    <div className="animate-in fade-in-50 space-y-4">
      {/* Season card — themed with app primary */}
      <Card className="rounded-3xl overflow-hidden border-none">
        <CardContent className="p-0">
          <div className="relative overflow-hidden p-5 bg-gradient-to-br from-primary via-primary/90 to-primary/70">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5" />
            <div className="pointer-events-none absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />
            <div className="relative">
              <div className="text-sm/none text-primary-foreground/60">Season</div>
              <div className="mt-2 text-2xl font-extrabold tracking-tight text-primary-foreground">
                TBL9
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main card with tabs — content renders directly on surface */}
      <Card className="rounded-3xl">
        <CardContent className="p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
            <TabsList className="w-full justify-start gap-6 bg-transparent p-0">
              <TabsTrigger
                value="matches"
                className={cn(
                  "rounded-none px-0 pb-2 text-base font-semibold",
                  "data-[state=active]:shadow-none",
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary"
                )}
              >
                Matches
              </TabsTrigger>

              <TabsTrigger
                value="table"
                className={cn(
                  "rounded-none px-0 pb-2 text-base font-semibold text-muted-foreground",
                  "data-[state=active]:text-foreground data-[state=active]:shadow-none",
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary"
                )}
              >
                Table
              </TabsTrigger>

              <TabsTrigger
                value="stats"
                className={cn(
                  "rounded-none px-0 pb-2 text-base font-semibold text-muted-foreground",
                  "data-[state=active]:text-foreground data-[state=active]:shadow-none",
                  "data-[state=active]:border-b-2 data-[state=active]:border-primary"
                )}
              >
                Stats
              </TabsTrigger>
            </TabsList>

            {/* MATCHES TAB */}
            <TabsContent value="matches" className="mt-4 space-y-3">
              {/* Matchday selector */}
              <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const idx = startedGwIds.indexOf(gwId ?? -1);
                    if (idx > 0) setGwId(startedGwIds[idx - 1]);
                  }}
                  disabled={!canPrev}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full border bg-background",
                    !canPrev && "opacity-40"
                  )}
                  aria-label="Previous matchday"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>

                <div className="text-center min-w-0">
                  <div className="text-lg font-extrabold truncate">
                    {activeName}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const idx = startedGwIds.indexOf(gwId ?? -1);
                    if (idx >= 0 && idx < startedGwIds.length - 1) setGwId(startedGwIds[idx + 1]);
                  }}
                  disabled={!canNext}
                  className={cn(
                    "grid h-11 w-11 place-items-center rounded-full border bg-background",
                    !canNext && "opacity-40"
                  )}
                  aria-label="Next matchday"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>

              {error ? <div className="text-sm text-red-600">{error}</div> : null}

              {loading ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Loading matches...
                </div>
              ) : games.length === 0 ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  No matches found for this matchday.
                </div>
              ) : (
                <div className="space-y-4">
                  {groupByDate(games).map(([date, list]) => (
                    <div key={date}>
                      <div className="px-1 text-sm font-semibold text-muted-foreground">
                        {formatDateHeading(date)}
                      </div>

                      <div className="mt-2 rounded-2xl border bg-card px-3 divide-y divide-border/40">
                        {list.map((g) => (
                          <MatchRow key={g.id} g={g} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TABLE TAB */}
            <TabsContent value="table" className="mt-4">
              {standingsLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading table...
                </div>
              ) : standings.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No table data yet.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="text-[11px]">
                        <TableHead className="w-[42px] pl-2 pr-1">Pos</TableHead>
                        <TableHead className="pr-1">Team</TableHead>
                        <TableHead className="w-[28px] px-1 text-center">PL</TableHead>
                        <TableHead className="w-[28px] px-1 text-center">W</TableHead>
                        <TableHead className="w-[28px] px-1 text-center">D</TableHead>
                        <TableHead className="w-[28px] px-1 text-center">L</TableHead>
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
                                <span className="font-semibold tabular-nums">{pos}</span>
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

                            <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.PL}</TableCell>
                            <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.W}</TableCell>
                            <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.D}</TableCell>
                            <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.L}</TableCell>
                            <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.GD}</TableCell>
                            <TableCell className="py-2 px-1 text-center font-mono font-bold tabular-nums">{r.Pts}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>

                  {standings.length > 8 && (
                    <div className="pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setExpanded((v) => !v)}
                        className="w-full justify-center rounded-2xl text-sm font-semibold"
                        type="button"
                      >
                        {expanded ? "Show less" : "View full table"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* STATS TAB */}
            <TabsContent value="stats" className="mt-4">
              {statsLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Loading stats...
                </div>
              ) : topScorers.length === 0 && topAssists.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Stats will appear once matches have been played.
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-2">
                  {topScorers.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                        Top scorers
                      </div>
                      <div className="space-y-1">
                        {topScorers.map((s, i) => (
                          <div
                            key={s.name + s.team}
                            className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-bold text-muted-foreground w-4 text-center tabular-nums">
                                {i + 1}
                              </span>
                              <div>
                                <div className="text-sm font-medium leading-tight">{s.name}</div>
                                <div className="text-[11px] text-muted-foreground">{s.team}</div>
                              </div>
                            </div>
                            <span className="text-sm font-bold tabular-nums">{s.goals}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {topAssists.length > 0 && (
                    <div>
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                        Top assists
                      </div>
                      <div className="space-y-1">
                        {topAssists.map((a, i) => (
                          <div
                            key={a.name + a.team}
                            className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-bold text-muted-foreground w-4 text-center tabular-nums">
                                {i + 1}
                              </span>
                              <div>
                                <div className="text-sm font-medium leading-tight">{a.name}</div>
                                <div className="text-[11px] text-muted-foreground">{a.team}</div>
                              </div>
                            </div>
                            <span className="text-sm font-bold tabular-nums">{a.assists}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="h-24 md:hidden" />
    </div>
  );
}
