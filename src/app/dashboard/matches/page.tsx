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

function labelDate(yyyyMmDd: string) {
  const d = new Date(yyyyMmDd);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

function groupByDate(games: UiGame[]) {
  const map = new Map<string, UiGame[]>();
  for (const g of games) {
    const key = g.date;
    map.set(key, [...(map.get(key) ?? []), g]);
  }
  // already in order from API kickoff_time, but keep dates sorted
  return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
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

function MatchListRow({
  g,
  mode,
}: {
  g: UiGame;
  mode: "fixtures" | "results";
}) {
  const showScore = mode === "results" && g.status === "completed";

  return (
    <div className="py-4">
      <div className="grid grid-cols-[minmax(0,1fr)_84px_minmax(0,1fr)] items-center gap-3">
        {/* home */}
        <div className="flex items-center justify-end gap-2 min-w-0">
          <div className="truncate text-sm font-semibold">{g.team1.name}</div>
          <Image
            src={g.team1.logoUrl}
            alt={g.team1.name}
            width={22}
            height={22}
            className="h-5 w-5 rounded-full object-cover"
          />
        </div>

        {/* center */}
        <div className="text-center">
          {showScore ? (
            <div className="text-sm font-extrabold tabular-nums">
              {g.score1 ?? 0} - {g.score2 ?? 0}
            </div>
          ) : (
            <div className="text-sm font-bold tabular-nums text-muted-foreground">
              {g.time}
            </div>
          )}
          {mode === "results" && showScore ? (
            <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
              {g.isFinal ? "FT" : "Played"}
            </div>
          ) : null}
        </div>

        {/* away */}
        <div className="flex items-center justify-start gap-2 min-w-0">
          <Image
            src={g.team2.logoUrl}
            alt={g.team2.name}
            width={22}
            height={22}
            className="h-5 w-5 rounded-full object-cover"
          />
          <div className="truncate text-sm font-semibold">{g.team2.name}</div>
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

  return (
    <div className="animate-in fade-in-50 space-y-4">
      {/* ✅ Season hero card (matches page only) */}
      <div
        className="rounded-3xl p-5 text-white shadow-sm ring-1 ring-black/5"
        style={{
          background:
            "linear-gradient(135deg, rgba(99,102,241,1) 0%, rgba(168,85,247,1) 45%, rgba(34,211,238,1) 100%)",
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-extrabold tracking-tight">Season</div>
            <div className="mt-1 text-base font-semibold text-white/95">
              {season.code}
            </div>
          </div>

          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-full bg-black/20 hover:bg-black/30 transition"
            onClick={() => setOpenSeason((v) => !v)}
            aria-label="Change season"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        </div>

        {openSeason ? (
          <div className="mt-4 rounded-2xl bg-white/10 backdrop-blur p-2">
            <div className="grid gap-1">
              {seasons.map((s) => (
                <button
                  key={s.code}
                  type="button"
                  onClick={() => {
                    setSeason(s);
                    setOpenSeason(false);
                  }}
                  className={cn(
                    "text-left rounded-xl px-3 py-2 text-sm font-semibold transition",
                    season.code === s.code ? "bg-white/20" : "hover:bg-white/10"
                  )}
                >
                  {s.code}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Main card container */}
      <div className="rounded-3xl border bg-card p-4 shadow-sm">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold tracking-tight">Matches</div>
            <div className="text-sm text-muted-foreground">
              {gwLoading
                ? "Loading gameweek..."
                : gwId
                ? `GW ${gwId} • ${activeName ?? "—"}`
                : "No gameweek"}
            </div>
          </div>


        {gwError ? (
          <div className="mt-3 text-sm text-red-600">⚠ {gwError}</div>
        ) : null}

        {/* Tabs */}
        <div className="mt-4">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as any)}
            className="w-full"
          >
            {/* nicer FPL-ish tabs */}
            <TabsList className="w-full justify-start gap-8 bg-transparent p-0">
              {(["matches", "table", "stats"] as const).map((k) => (
                <TabsTrigger
                  key={k}
                  value={k}
                  className={cn(
                    "rounded-none px-0 pb-2 text-base font-semibold",
                    "data-[state=active]:shadow-none",
                    "data-[state=active]:border-b-2 data-[state=active]:border-foreground",
                    "data-[state=inactive]:text-muted-foreground"
                  )}
                >
                  {k === "matches" ? "Matches" : k === "table" ? "Table" : "Stats"}
                </TabsTrigger>
              ))}
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
                      mode === "fixtures"
                        ? "bg-background shadow"
                        : "text-muted-foreground"
                    )}
                  >
                    Fixtures
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("results")}
                    className={cn(
                      "px-5 py-2 rounded-2xl text-sm font-semibold transition",
                      mode === "results"
                        ? "bg-background shadow"
                        : "text-muted-foreground"
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
                    <div className="text-sm font-bold">
                      {gwId ? `GW ${gwId}` : "—"}
                    </div>
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
              <div className="mt-4 space-y-4">
                {error ? (
                  <div className="text-sm text-red-600">⚠ {error}</div>
                ) : null}

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
                  <div className="space-y-5">
                    {groupByDate(games).map(([date, items]) => (
                      <div key={date}>
                        <div className="mb-2 text-sm font-extrabold">
                          {date === "0000-00-00" ? "TBD" : labelDate(date)}
                        </div>

                        <div className="rounded-2xl border bg-card px-4 divide-y divide-border/40">
                          {items.map((g) => (
                            <MatchListRow key={g.id} g={g} mode={mode} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
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

      {/* Space so bottom nav never covers content */}
      <div className="h-24 md:hidden" />
    </div>
  );
}
