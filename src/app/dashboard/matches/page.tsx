"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  kickoff_time: string;
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
  date: string; // YYYY-MM-DD
  time: string; // "10:00 AM"
  status: "completed" | "scheduled";
  venue: string;
  team1: UiTeam;
  team2: UiTeam;
  score1?: number | null;
  score2?: number | null;
  isFinal?: boolean;
};

/* ---------------- helpers ---------------- */

const TEAM_NAME_CLASS =
  "text-[14px] font-semibold leading-none tracking-tight whitespace-nowrap";

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

function formatKickoffLineUG(iso: string) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  })
    .format(d)
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

function mapApiMatchToUi(m: ApiMatch): UiGame {
  const homeName = m.home_team?.name ?? "Home";
  const awayName = m.away_team?.name ?? "Away";

  return {
    id: String(m.id),
    date: toUgDateKey(m.kickoff_time),
    time: toUgTime(m.kickoff_time),
    status: m.is_played ? "completed" : "scheduled",
    venue: `Match day ${m.gameweek_id}`,
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

/* ---------------- UI card ---------------- */

function MatchCard({ g, mode }: { g: UiGame; mode: "fixtures" | "results" }) {
  const showScore = mode === "results" && g.status === "completed";

  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3">
        {/* Top line */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground truncate">
            {formatKickoffLineUG(`${g.date}T${g.time}`.includes("T") ? new Date().toISOString() : new Date().toISOString())}
            {/* The line above is a safe fallback, but we show the real time below */}
            <span className="block">
              {g.status === "scheduled"
                ? `${g.time} • ${g.date}`
                : `FT • ${g.date}`}{" "}
              • {g.venue}
            </span>
          </div>

          <div className="shrink-0">
            {showScore ? (
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                {g.isFinal ? "FT" : "Played"}
              </Badge>
            ) : (
              <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                Upcoming
              </Badge>
            )}
          </div>
        </div>

        {/* Main row */}
        <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-x-3">
          <span className={cn(TEAM_NAME_CLASS, "truncate text-right")}>
            {g.team1.name}
          </span>

          <div className="h-7 w-7 justify-self-end rounded-full bg-muted overflow-hidden">
            <Image
              src={g.team1.logoUrl}
              alt={g.team1.name}
              width={28}
              height={28}
              className="h-7 w-7 object-cover"
            />
          </div>

          {showScore ? (
            <span className="justify-self-center font-mono text-[18px] font-extrabold tabular-nums">
              {g.score1 ?? 0} - {g.score2 ?? 0}
            </span>
          ) : (
            <span className="justify-self-center text-[14px] font-bold text-muted-foreground">
              vs
            </span>
          )}

          <div className="h-7 w-7 justify-self-start rounded-full bg-muted overflow-hidden">
            <Image
              src={g.team2.logoUrl}
              alt={g.team2.name}
              width={28}
              height={28}
              className="h-7 w-7 object-cover"
            />
          </div>

          <span className={cn(TEAM_NAME_CLASS, "truncate")}>{g.team2.name}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Page ---------------- */

export default function MatchesPage() {
  // Top-level page tabs
  const [tab, setTab] = React.useState<"matches" | "table" | "stats">("matches");

  // Fixtures/Results mode
  const [mode, setMode] = React.useState<"fixtures" | "results">("fixtures");

  // If visiting from “More -> Results”: /dashboard/matches?tab=results
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "results") setMode("results");
    if (t === "fixtures") setMode("fixtures");
  }, []);

  const [gw, setGw] = React.useState<{ current: ApiGameweek | null; next: ApiGameweek | null } | null>(null);
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

        // default to current
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

  const canPrev = Boolean(gwId && gwId > 1);
  const canNext = Boolean(gwId);

  const activeName =
    gw?.current?.id === gwId
      ? gw?.current?.name
      : gw?.next?.id === gwId
      ? gw?.next?.name
      : null;

  return (
    <div className="animate-in fade-in-50">
      <div className="rounded-3xl border bg-card p-4 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold tracking-tight">Matches</div>
            <div className="text-sm text-muted-foreground">
              {gwLoading ? "Loading gameweek..." : gwId ? `GW ${gwId} • ${activeName ?? "—"}` : "No gameweek"}
            </div>
          </div>

          <Button asChild variant="outline" className="rounded-2xl">
            <Link href="/dashboard">Back</Link>
          </Button>
        </div>

        {gwError ? <div className="mt-3 text-sm text-red-600">⚠ {gwError}</div> : null}

        {/* Tabs */}
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
              {/* Fixtures/Results + GW selector */}
              <div className="flex items-center justify-between gap-3">
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

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGwId((x) => (x ? Math.max(1, x - 1) : x))}
                    disabled={!canPrev}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full border bg-background",
                      !canPrev && "opacity-40"
                    )}
                    aria-label="Previous gameweek"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>

                  <div className="text-center">
                    <div className="text-sm font-bold">{gwId ? `GW ${gwId}` : "—"}</div>
                    <div className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                      {activeName ?? ""}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setGwId((x) => (x ? x + 1 : x))}
                    disabled={!canNext}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full border bg-background",
                      !canNext && "opacity-40"
                    )}
                    aria-label="Next gameweek"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="mt-4 space-y-3">
                {error ? <div className="text-sm text-red-600">⚠ {error}</div> : null}

                {loading ? (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                      Loading matches...
                    </CardContent>
                  </Card>
                ) : games.length === 0 ? (
                  <Card>
                    <CardContent className="p-4 text-sm text-muted-foreground">
                      {mode === "results"
                        ? "No results yet for this gameweek."
                        : "No fixtures found for this gameweek."}
                    </CardContent>
                  </Card>
                ) : (
                  games.map((g) => <MatchCard key={g.id} g={g} mode={mode} />)
                )}
              </div>
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
        </div>
      </div>

      <div className="h-24 md:hidden" />
    </div>
  );
}
