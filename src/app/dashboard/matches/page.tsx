"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  date: string; // YYYY-MM-DD (UG)
  time: string; // "10:00 AM" (UG)
  kickoffIso: string | null;

  status: "completed" | "scheduled";
  team1: UiTeam;
  team2: UiTeam;
  score1?: number | null;
  score2?: number | null;
  isFinal?: boolean;
};

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

function formatDateHeading(yyyyMmDd: string) {
  // yyyy-mm-dd -> "Sun 11 Jan"
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

/* ---------------- FPL-ish list row ---------------- */

function MatchRow({ g, mode }: { g: UiGame; mode: "fixtures" | "results" }) {
  const showScore = mode === "results" && g.status === "completed";

  return (
    <div className="py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_28px_72px_28px_minmax(0,1fr)] items-center gap-x-3">
        {/* left team */}
        <div className="min-w-0 text-right">
          <div className="truncate text-[14px] font-semibold leading-none">
            {g.team1.name}
          </div>
        </div>

        {/* left logo */}
        <div className="h-7 w-7 justify-self-end rounded-full bg-muted overflow-hidden">
          <Image
            src={g.team1.logoUrl}
            alt={g.team1.name}
            width={28}
            height={28}
            className="h-7 w-7 object-cover"
          />
        </div>

        {/* center time / score */}
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

        {/* right logo */}
        <div className="h-7 w-7 justify-self-start rounded-full bg-muted overflow-hidden">
          <Image
            src={g.team2.logoUrl}
            alt={g.team2.name}
            width={28}
            height={28}
            className="h-7 w-7 object-cover"
          />
        </div>

        {/* right team */}
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
  // Top-level page tabs
  const [tab, setTab] = React.useState<"matches" | "table" | "stats">("matches");

  // Fixtures/Results mode
  const [mode, setMode] = React.useState<"fixtures" | "results">("fixtures");

  // Season hero (matches only)
  const [season, setSeason] = React.useState<Season>(seasons[0]);
  const [openSeason, setOpenSeason] = React.useState(false);

  // If visiting from “More -> Results”: /dashboard/matches?tab=results
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "results") setMode("results");
    if (t === "fixtures") setMode("fixtures");
  }, []);

  const [gw, setGw] = React.useState<{
    current: ApiGameweek | null;
    next: ApiGameweek | null;
  } | null>(null);
  const [gwId, setGwId] = React.useState<number | null>(null);

  const [games, setGames] = React.useState<UiGame[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);
  const [gwError, setGwError] = React.useState<string | null>(null);

  // Load current/next gameweek
  React.useEffect(() => {
    (async () => {
      try {
        setGwLoading(true);
        setGwError(null);

        const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load gameweeks");

        const current = json.current ?? null;
        const next = json.next ?? null;

        setGw({ current, next });
        setGwId(current?.id ?? next?.id ?? null);
      } catch (e: any) {
        setGwError(e?.message ?? "Failed to load gameweeks");
      } finally {
        setGwLoading(false);
      }
    })();
  }, []);

  // Fetch matches for gwId + mode
  React.useEffect(() => {
    if (!gwId) return;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const played = mode === "results" ? "1" : "0";
        const res = await fetch(`/api/matches?gw_id=${gwId}&played=${played}`, {
          cache: "no-store",
        });
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
  }, [gwId, mode]);

  const activeName =
    gw?.current?.id === gwId
      ? gw?.current?.name
      : gw?.next?.id === gwId
      ? gw?.next?.name
      : null;

  const canPrev = Boolean(gwId && gwId > 1);
  const canNext = Boolean(gwId); // you can tighten this later

 // inside MatchesPage() return...

return (
  <div className="animate-in fade-in-50 space-y-4">
    {/* ✅ Season card ONLY on matches page */}
    <Card className="rounded-3xl overflow-hidden border-none">
      <CardContent className="p-0">
        <div className="p-5 text-white bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400">
          <div className="text-sm/none opacity-90">Season</div>
          <div className="mt-2 flex items-center gap-2">
            <div className="text-2xl font-extrabold tracking-tight">TBL8</div>
            
          </div>
        </div>
      </CardContent>
    </Card>

    {/* ✅ Main card with tabs like FPL */}
    <Card className="rounded-3xl">
      <CardContent className="p-4">
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
          <TabsContent value="matches" className="mt-4 space-y-3">
            {/* ✅ Matchday selector with arrows */}
            <div className="grid grid-cols-[44px_1fr_44px] items-center gap-2">
              {/* Left arrow */}
              <button
                type="button"
                onClick={() => setGwId((x) => (x ? Math.max(1, x - 1) : x))}
                disabled={!canPrev}
                className={cn(
                  "grid h-11 w-11 place-items-center rounded-full border bg-background",
                  !canPrev && "opacity-40"
                )}
                aria-label="Previous matchday"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>

              {/* Center title */}
              <div className="text-center min-w-0">
                <div className="text-lg font-extrabold truncate">
                  {activeName ?? (gwId ? `Match day ${gwId}` : "Match day —")}
                </div>
              </div>

              {/* Right arrow */}
              <button
                type="button"
                onClick={() => setGwId((x) => (x ? x + 1 : x))}
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

            {/* Fixtures / Results toggle */}
            <div className="rounded-2xl bg-muted p-1 inline-flex">
              <button
                type="button"
                onClick={() => setMode("fixtures")}
                className={cn(
                  "px-5 py-2 rounded-2xl text-sm font-semibold transition",
                  mode === "fixtures" ? "bg-background shadow" : "text-muted-foreground"
                )}
              >
                Fixtures
              </button>
              <button
                type="button"
                onClick={() => setMode("results")}
                className={cn(
                  "px-5 py-2 rounded-2xl text-sm font-semibold transition",
                  mode === "results" ? "bg-background shadow" : "text-muted-foreground"
                )}
              >
                Results
              </button>
            </div>

            {/* Content */}
            {error ? <div className="text-sm text-red-600">⚠ {error}</div> : null}

            {loading ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                Loading matches...
              </div>
            ) : games.length === 0 ? (
              <div className="text-sm text-muted-foreground py-6 text-center">
                {mode === "results"
                  ? "No results yet for this gameweek."
                  : "No fixtures found for this gameweek."}
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
                        <MatchRow key={g.id} g={g} mode={mode} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TABLE TAB */}
          <TabsContent value="table" className="mt-4">
            <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Table will be connected next (standings computed from matches).
            </div>
          </TabsContent>

          {/* STATS TAB */}
          <TabsContent value="stats" className="mt-4">
            <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
              Stats coming next (goals, assists, clean sheets).
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>

    <div className="h-24 md:hidden" />
  </div>
);
}
