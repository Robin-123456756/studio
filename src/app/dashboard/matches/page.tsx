"use client";

import * as React from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
// lucide icons removed — GW nav now uses chip selector

import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { useLivePoll } from "@/hooks/use-live-poll";
import { normalizePosition } from "@/lib/pitch-helpers";
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

type MatchEvent = {
  playerName: string;
  playerId: string;
  goals: number;
  penalties: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  bonus: number;
  isLady: boolean;
};

type ApiMatch = {
  id: number;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean;
  is_final: boolean;
  minutes: number | null;
  home_team_uuid: string;
  away_team_uuid: string;
  home_team: ApiTeam | null;
  away_team: ApiTeam | null;
  home_events?: MatchEvent[];
  away_events?: MatchEvent[];
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
  minutes?: number | null;
  homeEvents?: MatchEvent[];
  awayEvents?: MatchEvent[];
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
  LP: number;
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
    position: string | null;
    teamName: string | null;
    teamShort: string | null;
  } | null;
};

/* ---------------- helpers ---------------- */

function formatDateHeading(yyyyMmDd: string) {
  if (!yyyyMmDd || yyyyMmDd === "0000-00-00") return "Date TBD";
  const d = new Date(`${yyyyMmDd}T00:00:00`);
  if (isNaN(d.getTime())) return "Date TBD";
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
  return Array.from(map.entries()).sort((a, b) => {
    const ta = new Date(a[0]).getTime() || Infinity;
    const tb = new Date(b[0]).getTime() || Infinity;
    return ta - tb;
  });
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

function mapApiMatchToUi(m: ApiMatch, deadlineFallback?: string | null): UiGame {
  const homeName = m.home_team?.name ?? "Home";
  const awayName = m.away_team?.name ?? "Away";
  const kickoffIso = m.kickoff_time ?? null;
  const fallbackIso = kickoffIso ?? deadlineFallback ?? null;

  return {
    id: String(m.id),
    date: fallbackIso ? toUgDateKey(fallbackIso) : "0000-00-00",
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
    minutes: m.minutes,
    homeEvents: m.home_events,
    awayEvents: m.away_events,
  };
}

function posBarClass(pos: number) {
  if (pos >= 1 && pos <= 4) return "bg-emerald-500";   // Main Cup
  if (pos >= 5 && pos <= 8) return "bg-amber-500";     // Semivule Cup
  return "bg-transparent";
}

/* ---------------- Skeleton loader (FPL-style rows inside card) ---------------- */

function MatchListSkeleton() {
  return (
    <Card className="rounded-2xl overflow-hidden">
      <CardContent className="p-0">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={cn("px-4 py-3.5 animate-pulse", i > 0 && "border-t border-border/40")}>
            <div className="grid grid-cols-[minmax(0,1fr)_28px_56px_28px_minmax(0,1fr)] items-center gap-x-2">
              <div className="flex justify-end"><div className="h-3 w-20 rounded bg-muted" /></div>
              <div className="h-7 w-7 rounded-full bg-muted justify-self-end" />
              <div className="flex justify-center"><div className="h-5 w-12 rounded-md bg-muted" /></div>
              <div className="h-7 w-7 rounded-full bg-muted justify-self-start" />
              <div><div className="h-3 w-20 rounded bg-muted" /></div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ---------------- Stat bar row (FPL-style progress fill) ---------------- */

function StatBarRow({
  rank,
  label,
  sublabel,
  value,
  maxValue,
  color,
  icon,
  logo,
}: {
  rank: number;
  label: string;
  sublabel: string;
  value: number;
  maxValue: number;
  color: string;
  icon?: React.ReactNode;
  logo?: string;
}) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  return (
    <div className="group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted/30">
      <span className="text-xs font-bold text-muted-foreground w-4 text-center tabular-nums shrink-0">
        {rank}
      </span>
      {logo && (
        <Image src={logo} alt={label} width={20} height={20} className="shrink-0 object-contain" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight truncate">{label}</div>
            <div className="text-[11px] text-muted-foreground">{sublabel}</div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {icon}
            <span className="text-sm font-bold tabular-nums">{value}</span>
          </div>
        </div>
        {/* Progress bar fill */}
        <div className="mt-1.5 h-1 w-full rounded-full bg-muted/60 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all duration-500", color)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

/* ---------------- FPL-style match row (teams + score only) ---------------- */

function MatchRow({ g, onNavigate }: { g: UiGame; onNavigate?: (id: string) => void }) {
  const showScore = g.status === "completed";
  const isLive = showScore && !g.isFinal;
  const homeWin = showScore && (g.score1 ?? 0) > (g.score2 ?? 0);
  const awayWin = showScore && (g.score2 ?? 0) > (g.score1 ?? 0);

  return (
    <div
      className={cn(
        "relative px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30 active:bg-muted/50",
        isLive && "bg-red-500/[0.03]"
      )}
      onClick={() => onNavigate?.(g.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onNavigate?.(g.id)}
    >
      {/* Live left-border accent */}
      {isLive && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500" />
      )}

      <div className="grid grid-cols-[minmax(0,1fr)_28px_56px_28px_minmax(0,1fr)] items-center gap-x-2">
        {/* Home name */}
        <div className="min-w-0 text-right">
          <span className={cn(
            "truncate text-[13px] leading-none block",
            homeWin ? "font-bold" : "font-medium"
          )}>
            {g.team1.name}
          </span>
        </div>

        {/* Home logo */}
        <div className="h-7 w-7 justify-self-end shrink-0">
          <Image src={g.team1.logoUrl} alt={g.team1.name} width={28} height={28} className="h-7 w-7 object-contain" />
        </div>

        {/* Score or kickoff time */}
        <div className="text-center">
          {showScore ? (
            <>
              <div className={cn(
                "font-mono text-[15px] font-extrabold tabular-nums leading-tight",
                isLive && "text-red-600 dark:text-red-500"
              )}>
                {g.score1 ?? 0} - {g.score2 ?? 0}
              </div>
              {g.isFinal ? (
                <div className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">FT</div>
              ) : (
                <span className="inline-flex items-center gap-1 mt-0.5 text-[9px] font-bold text-red-600 dark:text-red-500">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                  </span>
                  {g.minutes != null ? `${g.minutes}'` : "LIVE"}
                </span>
              )}
            </>
          ) : (
            <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">{g.time}</span>
          )}
        </div>

        {/* Away logo */}
        <div className="h-7 w-7 justify-self-start shrink-0">
          <Image src={g.team2.logoUrl} alt={g.team2.name} width={28} height={28} className="h-7 w-7 object-contain" />
        </div>

        {/* Away name */}
        <div className="min-w-0">
          <span className={cn(
            "truncate text-[13px] leading-none block",
            awayWin ? "font-bold" : "font-medium"
          )}>
            {g.team2.name}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Page ---------------- */

function MatchesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab");
  const initialGw = searchParams.get("gw");
  const [tab, setTab] = React.useState<"matches" | "table" | "stats">(
    initialTab === "table" || initialTab === "stats" ? initialTab : "matches"
  );

  const [allGws, setAllGws] = React.useState<ApiGameweek[]>([]);
  const [gwId, setGwId] = React.useState<number | null>(
    initialGw ? Number(initialGw) : null
  );

  const [games, setGames] = React.useState<UiGame[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Table + Stats state
  const [standings, setStandings] = React.useState<StandingsRow[]>([]);
  const [standingsLoading, setStandingsLoading] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);
  const [tableView, setTableView] = React.useState<"short" | "full" | "form">("short");

  // All played matches (for form) + all upcoming (for next opponent)
  const [allPlayedMatches, setAllPlayedMatches] = React.useState<ApiMatch[]>([]);
  const [allUpcomingMatches, setAllUpcomingMatches] = React.useState<ApiMatch[]>([]);

  const [statsData, setStatsData] = React.useState<StatPlayer[]>([]);
  const [disciplineTab, setDisciplineTab] = React.useState<"yellow" | "red">("yellow");
  const [statsView, setStatsView] = React.useState<"players" | "teams">("players");
  const [statsLoading, setStatsLoading] = React.useState(true);

  // Gameweeks that have started (deadline passed) — sorted by id
  const startedGwIds = React.useMemo(() => {
    return allGws
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

        // Only set default if no gw was provided via query param
        setGwId((prev) => prev ?? defaultGw);
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

        const res = await fetch(`/api/matches?gw_id=${gwId}&enrich=1`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load matches");

        const activeDeadline = allGws.find((g) => g.id === gwId)?.deadline_time ?? null;
        const mapped = (json.matches as ApiMatch[]).map((m) => mapApiMatchToUi(m, activeDeadline));
        setGames(mapped);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load matches");
        setGames([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [gwId, allGws]);

  // Auto-poll every 30s while any match is live (FPL-style)
  const hasLiveMatch = games.some((g) => g.status === "completed" && !g.isFinal);
  const refreshMatches = React.useCallback(() => {
    if (!gwId) return;
    const activeDeadline = allGws.find((g) => g.id === gwId)?.deadline_time ?? null;
    fetch(`/api/matches?gw_id=${gwId}&enrich=1`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.matches) {
          setGames((json.matches as ApiMatch[]).map((m) => mapApiMatchToUi(m, activeDeadline)));
        }
      })
      .catch(() => {});
  }, [gwId, allGws]);
  useLivePoll(refreshMatches, hasLiveMatch, 30_000);

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

  // Fetch all matches (played + upcoming) for form & next opponent
  React.useEffect(() => {
    (async () => {
      try {
        const { data: played } = await supabase
          .from("matches")
          .select("id,gameweek_id,home_goals,away_goals,home_team_uuid,away_team_uuid,is_played,is_final")
          .or("is_played.eq.true,is_final.eq.true")
          .order("gameweek_id", { ascending: true });
        setAllPlayedMatches((played as ApiMatch[]) ?? []);

        const { data: upcoming } = await supabase
          .from("matches")
          .select("id,gameweek_id,home_team_uuid,away_team_uuid,is_played,is_final,kickoff_time")
          .or("is_played.eq.false,is_played.is.null")
          .order("gameweek_id", { ascending: true });
        setAllUpcomingMatches((upcoming as ApiMatch[]) ?? []);
      } catch {
        // silent
      }
    })();
  }, []);

  // Fetch player stats across ALL gameweeks (cumulative top scorers / assists)
  React.useEffect(() => {
    (async () => {
      try {
        setStatsLoading(true);
        const res = await fetch("/api/player-stats", { cache: "no-store" });
        const json = await res.json();
        if (res.ok) setStatsData(json.stats ?? []);
      } catch {
        // silent
      } finally {
        setStatsLoading(false);
      }
    })();
  }, []);

  const activeGw = allGws.find((g) => g.id === gwId);
  const activeName = activeGw?.name ?? (gwId ? `Match day ${gwId}` : "Match day —");

  // (prev/next arrows removed — GW chip selector handles navigation)

  // Auto-scroll the active GW chip into view — only when gwId changes
  const gwChipContainerRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (gwId == null || !gwChipContainerRef.current) return;
    const active = gwChipContainerRef.current.querySelector<HTMLElement>(`[data-gw="${gwId}"]`);
    if (active) {
      active.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
    }
  }, [gwId]);

  const visibleRows = expanded ? standings : standings.slice(0, 8);

  // Build team name map from standings for next opponent display
  const teamNameMap = React.useMemo(() => {
    const m = new Map<string, { name: string; short: string; logoUrl: string }>();
    for (const r of standings) {
      m.set(r.teamId, { name: r.name, short: r.name.slice(0, 3).toUpperCase(), logoUrl: r.logoUrl });
    }
    return m;
  }, [standings]);

  // Compute form (last 5 results) per team: W/D/L
  const teamForm = React.useMemo(() => {
    const formMap = new Map<string, ("W" | "D" | "L")[]>();
    // allPlayedMatches are sorted by gameweek ascending
    for (const m of allPlayedMatches) {
      const hg = m.home_goals ?? 0;
      const ag = m.away_goals ?? 0;
      const homeId = (m as any).home_team_uuid ?? (m as any).home_team_uid;
      const awayId = (m as any).away_team_uuid ?? (m as any).away_team_uid;
      if (!homeId || !awayId) continue;

      if (!formMap.has(homeId)) formMap.set(homeId, []);
      if (!formMap.has(awayId)) formMap.set(awayId, []);

      if (hg > ag) {
        formMap.get(homeId)!.push("W");
        formMap.get(awayId)!.push("L");
      } else if (hg < ag) {
        formMap.get(homeId)!.push("L");
        formMap.get(awayId)!.push("W");
      } else {
        formMap.get(homeId)!.push("D");
        formMap.get(awayId)!.push("D");
      }
    }
    // Keep only last 5
    const result = new Map<string, ("W" | "D" | "L")[]>();
    for (const [id, arr] of formMap) {
      result.set(id, arr.slice(-5));
    }
    return result;
  }, [allPlayedMatches]);

  // Compute next opponent per team
  const nextOpponent = React.useMemo(() => {
    const oppMap = new Map<string, { opponentId: string; isHome: boolean }>();
    for (const m of allUpcomingMatches) {
      const homeId = (m as any).home_team_uuid ?? (m as any).home_team_uid;
      const awayId = (m as any).away_team_uuid ?? (m as any).away_team_uid;
      if (!homeId || !awayId) continue;
      if (!oppMap.has(homeId)) oppMap.set(homeId, { opponentId: awayId, isHome: true });
      if (!oppMap.has(awayId)) oppMap.set(awayId, { opponentId: homeId, isHome: false });
    }
    return oppMap;
  }, [allUpcomingMatches]);

  // Aggregate stats: top scorers + top assists from fetched player stats
  const scorerMap = new Map<string, { name: string; goals: number; team: string }>();
  const assistMap = new Map<string, { name: string; assists: number; team: string }>();
  const csMap = new Map<string, { name: string; cleanSheets: number; team: string }>();
  const ycMap = new Map<string, { name: string; yellowCards: number; team: string }>();
  const rcMap = new Map<string, { name: string; redCards: number; team: string }>();
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
    if (s.cleanSheet && normalizePosition(s.player?.position) === "Goalkeeper") {
      const existing = csMap.get(s.playerId);
      csMap.set(s.playerId, {
        name,
        cleanSheets: (existing?.cleanSheets ?? 0) + 1,
        team,
      });
    }
    if (s.yellowCards > 0) {
      const existing = ycMap.get(s.playerId);
      ycMap.set(s.playerId, {
        name,
        yellowCards: (existing?.yellowCards ?? 0) + s.yellowCards,
        team,
      });
    }
    if (s.redCards > 0) {
      const existing = rcMap.get(s.playerId);
      rcMap.set(s.playerId, {
        name,
        redCards: (existing?.redCards ?? 0) + s.redCards,
        team,
      });
    }
  }
  const topScorers = [...scorerMap.values()].sort((a, b) => b.goals - a.goals).slice(0, 5);
  const topAssists = [...assistMap.values()].sort((a, b) => b.assists - a.assists).slice(0, 5);
  const topCleanSheets = [...csMap.values()].sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 5);
  const topYellowCards = [...ycMap.values()].sort((a, b) => b.yellowCards - a.yellowCards).slice(0, 5);
  const topRedCards = [...rcMap.values()].sort((a, b) => b.redCards - a.redCards).slice(0, 5);

  // Team-level aggregations — use full team name
  const teamStatsMap = new Map<string, { team: string; logoUrl: string; goals: number; assists: number; cleanSheets: number; yellowCards: number; redCards: number }>();
  for (const s of statsData) {
    const teamFull = s.player?.teamName ?? s.player?.teamShort ?? "—";
    const existing = teamStatsMap.get(teamFull);
    if (existing) {
      existing.goals += s.goals;
      existing.assists += s.assists;
      existing.cleanSheets += (s.cleanSheet && normalizePosition(s.player?.position) === "Goalkeeper") ? 1 : 0;
      existing.yellowCards += s.yellowCards;
      existing.redCards += s.redCards;
    } else {
      const row = standings.find((r) => r.name === teamFull || r.name.slice(0, 3).toUpperCase() === teamFull);
      teamStatsMap.set(teamFull, {
        team: teamFull,
        logoUrl: row?.logoUrl ?? "/placeholder-team.png",
        goals: s.goals,
        assists: s.assists,
        cleanSheets: (s.cleanSheet && normalizePosition(s.player?.position) === "Goalkeeper") ? 1 : 0,
        yellowCards: s.yellowCards,
        redCards: s.redCards,
      });
    }
  }
  // Use GF from standings for "Most goals" (goals scored by team, not individual player goals)
  const teamsByGoals = standings
    .map((r) => ({ team: r.name, logoUrl: r.logoUrl, goals: r.GF }))
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 5);
  const teamsByAssists = [...teamStatsMap.values()].filter((t) => t.assists > 0).sort((a, b) => b.assists - a.assists).slice(0, 5);
  const teamsByCS = [...teamStatsMap.values()].filter((t) => t.cleanSheets > 0).sort((a, b) => b.cleanSheets - a.cleanSheets).slice(0, 5);
  const teamsByYC = [...teamStatsMap.values()].filter((t) => t.yellowCards > 0).sort((a, b) => b.yellowCards - a.yellowCards).slice(0, 5);
  const teamsByRC = [...teamStatsMap.values()].filter((t) => t.redCards > 0).sort((a, b) => b.redCards - a.redCards).slice(0, 5);

  return (
    <div className="animate-in fade-in-50 space-y-4">

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
            <TabsContent value="matches" className="mt-4 space-y-4">
              {/* Horizontal scrollable GW chip selector (ESPN/FotMob style) */}
              {startedGwIds.length > 0 && (
                <div className="-mx-4 px-4">
                  <div ref={gwChipContainerRef} className="flex gap-2 overflow-x-auto pb-2 scrollbar-none" style={{ scrollbarWidth: "none" }}>
                    {startedGwIds.map((id) => {
                      const gw = allGws.find((g) => g.id === id);
                      const label = gw?.name ?? `MD ${id}`;
                      const shortLabel = label.replace(/^(Match\s*day|Gameweek)\s*/i, "MD ");
                      const isActive = id === gwId;
                      return (
                        <button
                          key={id}
                          type="button"
                          data-gw={id}
                          onClick={() => setGwId(id)}
                          className={cn(
                            "shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
                            isActive
                              ? "bg-primary text-primary-foreground shadow-sm"
                              : "bg-muted/60 text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active GW title + deadline */}
              <div className="text-center">
                <div className="text-lg font-extrabold truncate">{activeName}</div>
                {activeGw?.deadline_time && (
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    Deadline: {new Intl.DateTimeFormat("en-GB", {
                      day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
                      hour12: true, timeZone: "Africa/Kampala",
                    }).format(new Date(activeGw.deadline_time))}
                  </div>
                )}
              </div>

              {error ? <div className="text-sm text-red-600">{error}</div> : null}

              {loading ? (
                <MatchListSkeleton />
              ) : games.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="text-3xl">🏟️</div>
                  <div className="text-sm font-medium text-muted-foreground">
                    No matches scheduled for this matchday
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupByDate(games).map(([date, list]) => (
                    <div key={date}>
                      <div className="flex items-center gap-2 px-1 mb-2">
                        <div className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider">
                          {formatDateHeading(date)}
                        </div>
                        <div className="flex-1 h-px bg-border/40" />
                      </div>

                      {/* All matches inside one card — FPL style */}
                      <Card className="rounded-2xl overflow-hidden">
                        <CardContent className="p-0">
                          {list.map((g, i) => (
                            <div key={g.id} className={cn(i > 0 && "border-t border-border/40")}>
                              <MatchRow g={g} onNavigate={(id) => router.push(`/match/${id}?gw=${gwId}`)} />
                            </div>
                          ))}
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* TABLE TAB */}
            <TabsContent value="table" className="mt-4">
              {standingsLoading ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-2">
                      <div className="h-3 w-4 rounded bg-muted animate-pulse" />
                      <div className="h-5 w-5 rounded-full bg-muted animate-pulse" />
                      <div className="h-3 flex-1 rounded bg-muted animate-pulse" />
                      <div className="h-3 w-6 rounded bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : standings.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No table data yet.
                </div>
              ) : (
                <>
                  {/* Sub-tabs: Short / Full / Form */}
                  <div className="flex gap-1 mb-3">
                    {(["short", "full", "form"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setTableView(v)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors",
                          tableView === v
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  {/* ---- SHORT VIEW ---- */}
                  {tableView === "short" && (
                    <div className="overflow-x-auto">
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
                            <TableHead className="w-[28px] px-1 text-center">LP</TableHead>
                            <TableHead className="w-[32px] px-1 text-center">Pts</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleRows.map((r, idx) => {
                            const pos = idx + 1;
                            return (
                              <TableRow key={r.teamId} className="text-[12px]">
                                <TableCell className="py-2 pl-2 pr-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className={`h-5 w-1.5 rounded-full ${posBarClass(pos)}`} />
                                    <span className="font-semibold tabular-nums">{pos}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 pr-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Image src={r.logoUrl} alt={r.name} width={20} height={20} className="shrink-0 object-contain" />
                                    <span className="truncate text-[12px] font-medium">{r.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.PL}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.W}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.D}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.L}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums">{r.GD}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-pink-600">{r.LP}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono font-bold tabular-nums">{r.Pts}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* ---- FULL VIEW ---- */}
                  {tableView === "full" && (
                    <div className="overflow-x-auto -mx-4 px-0">
                      <Table className="min-w-[600px]">
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead className="w-[42px] pl-3 pr-1 sticky left-0 bg-card z-10">Pos</TableHead>
                            <TableHead className="w-[100px] pr-1 sticky left-[42px] bg-card z-10">Team</TableHead>
                            <TableHead className="w-[32px] px-1 text-center">PL</TableHead>
                            <TableHead className="w-[32px] px-1 text-center">W</TableHead>
                            <TableHead className="w-[32px] px-1 text-center">D</TableHead>
                            <TableHead className="w-[32px] px-1 text-center">L</TableHead>
                            <TableHead className="w-[32px] px-1 text-center">GF</TableHead>
                            <TableHead className="w-[32px] px-1 text-center">GA</TableHead>
                            <TableHead className="w-[32px] px-1 text-center">GD</TableHead>
                            <TableHead className="w-[28px] px-1 text-center">LP</TableHead>
                            <TableHead className="w-[32px] px-1 text-center">Pts</TableHead>
                            <TableHead className="px-2 text-center">Next</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleRows.map((r, idx) => {
                            const pos = idx + 1;
                            const opp = nextOpponent.get(r.teamId);
                            const oppInfo = opp ? teamNameMap.get(opp.opponentId) : null;
                            return (
                              <TableRow key={r.teamId} className="text-[12px]">
                                <TableCell className="py-2 pl-3 pr-1 sticky left-0 bg-card z-10">
                                  <div className="flex items-center gap-1.5">
                                    <div className={`h-5 w-1.5 rounded-full ${posBarClass(pos)}`} />
                                    <span className="font-semibold tabular-nums">{pos}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 pr-1 sticky left-[42px] bg-card z-10">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Image src={r.logoUrl} alt={r.name} width={20} height={20} className="shrink-0 object-contain" />
                                    <span className="truncate text-[12px] font-medium">{r.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-[11px]">{r.PL}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-[11px]">{r.W}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-[11px]">{r.D}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-[11px]">{r.L}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-[11px]">{r.GF}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-[11px]">{r.GA}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-[11px]">{r.GD}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono tabular-nums text-[11px] text-pink-600">{r.LP}</TableCell>
                                <TableCell className="py-2 px-1 text-center font-mono font-bold tabular-nums text-[11px]">{r.Pts}</TableCell>
                                <TableCell className="py-2 px-2 text-center whitespace-nowrap">
                                  {oppInfo ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <img src={oppInfo.logoUrl} alt={oppInfo.name} width={16} height={16} className="shrink-0 object-contain" />
                                      <span className="text-[10px] text-muted-foreground">
                                        {oppInfo.short} ({opp!.isHome ? "H" : "A"})
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* ---- FORM VIEW ---- */}
                  {tableView === "form" && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-[11px]">
                            <TableHead className="w-[42px] pl-2 pr-1">Pos</TableHead>
                            <TableHead className="pr-1">Team</TableHead>
                            <TableHead className="px-1 text-center">Form</TableHead>
                            <TableHead className="px-2 text-center">Next</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleRows.map((r, idx) => {
                            const pos = idx + 1;
                            const form = teamForm.get(r.teamId) ?? [];
                            const opp = nextOpponent.get(r.teamId);
                            const oppInfo = opp ? teamNameMap.get(opp.opponentId) : null;
                            return (
                              <TableRow key={r.teamId} className="text-[12px]">
                                <TableCell className="py-2 pl-2 pr-1">
                                  <div className="flex items-center gap-1.5">
                                    <div className={`h-5 w-1.5 rounded-full ${posBarClass(pos)}`} />
                                    <span className="font-semibold tabular-nums">{pos}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 pr-1">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <Image src={r.logoUrl} alt={r.name} width={20} height={20} className="shrink-0 object-contain" />
                                    <span className="truncate text-[12px] font-medium">{r.name}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 px-1">
                                  <div className="flex items-center justify-center gap-1">
                                    {form.length === 0 ? (
                                      <span className="text-[10px] text-muted-foreground">—</span>
                                    ) : (
                                      form.map((result, i) => (
                                        <span
                                          key={i}
                                          className={cn(
                                            "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white",
                                            result === "W" && "bg-emerald-500",
                                            result === "L" && "bg-red-500",
                                            result === "D" && "bg-gray-400"
                                          )}
                                        >
                                          {result}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="py-2 px-2 text-center whitespace-nowrap">
                                  {oppInfo ? (
                                    <div className="flex items-center justify-center gap-1">
                                      <img src={oppInfo.logoUrl} alt={oppInfo.name} width={16} height={16} className="shrink-0 object-contain" />
                                      <span className="text-[10px] text-muted-foreground">
                                        {oppInfo.short} ({opp!.isHome ? "H" : "A"})
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Qualification legend */}
                  <div className="pt-3 px-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-1.5 rounded-full bg-emerald-500" />
                      <span>Qualify to Main Cup</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-1.5 rounded-full bg-amber-500" />
                      <span>Qualify to Semivule Cup</span>
                    </div>
                  </div>

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
                <div className="space-y-3 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="h-3 w-3 rounded bg-muted animate-pulse" />
                        <div className="space-y-1.5">
                          <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                          <div className="h-2 w-14 rounded bg-muted animate-pulse" />
                        </div>
                      </div>
                      <div className="h-4 w-5 rounded bg-muted animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : topScorers.length === 0 && topAssists.length === 0 && topCleanSheets.length === 0 ? (
                <div className="py-10 text-center space-y-2">
                  <div className="text-3xl">📊</div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Stats will appear once matches have been played
                  </div>
                </div>
              ) : (
                <>
                  {/* Players / Teams toggle */}
                  <div className="flex gap-1 mb-4">
                    {(["players", "teams"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setStatsView(v)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors",
                          statsView === v
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>

                  {/* ---- PLAYERS VIEW ---- */}
                  {statsView === "players" && (
                    <div className="grid gap-6 sm:grid-cols-2">
                      {topScorers.length > 0 && (
                        <div>
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                            Top scorers
                          </div>
                          <div className="space-y-0.5">
                            {topScorers.map((s, i) => (
                              <StatBarRow
                                key={s.name + s.team}
                                rank={i + 1}
                                label={s.name}
                                sublabel={s.team}
                                value={s.goals}
                                maxValue={topScorers[0]?.goals ?? 1}
                                color="bg-emerald-500"
                                icon={<span className="text-[10px]">⚽</span>}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {topCleanSheets.length > 0 && (
                        <div>
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                            Most clean sheets
                          </div>
                          <div className="space-y-0.5">
                            {topCleanSheets.map((c, i) => (
                              <StatBarRow
                                key={c.name + c.team}
                                rank={i + 1}
                                label={c.name}
                                sublabel={c.team}
                                value={c.cleanSheets}
                                maxValue={topCleanSheets[0]?.cleanSheets ?? 1}
                                color="bg-blue-500"
                                icon={<span className="text-[10px]">🧤</span>}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {topAssists.length > 0 && (
                        <div>
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                            Top assists
                          </div>
                          <div className="space-y-0.5">
                            {topAssists.map((a, i) => (
                              <StatBarRow
                                key={a.name + a.team}
                                rank={i + 1}
                                label={a.name}
                                sublabel={a.team}
                                value={a.assists}
                                maxValue={topAssists[0]?.assists ?? 1}
                                color="bg-violet-500"
                                icon={<span className="text-[10px]">👟</span>}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Discipline */}
                      {(topYellowCards.length > 0 || topRedCards.length > 0) && (
                        <div className="sm:col-span-2">
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                            Discipline
                          </div>
                          <div className="flex gap-1 mb-3">
                            <button
                              type="button"
                              onClick={() => setDisciplineTab("yellow")}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                                disciplineTab === "yellow"
                                  ? "bg-yellow-400 text-yellow-900"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                            >
                              Yellow Cards
                            </button>
                            <button
                              type="button"
                              onClick={() => setDisciplineTab("red")}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                                disciplineTab === "red"
                                  ? "bg-red-500 text-white"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                            >
                              Red Cards
                            </button>
                          </div>

                          {disciplineTab === "yellow" && (
                            <div className="space-y-0.5">
                              {topYellowCards.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-3 text-center">No yellow cards yet.</div>
                              ) : (
                                topYellowCards.map((p, i) => (
                                  <StatBarRow
                                    key={p.name + p.team}
                                    rank={i + 1}
                                    label={p.name}
                                    sublabel={p.team}
                                    value={p.yellowCards}
                                    maxValue={topYellowCards[0]?.yellowCards ?? 1}
                                    color="bg-yellow-400"
                                    icon={<div className="w-2.5 h-3 rounded-[1px] bg-yellow-400" />}
                                  />
                                ))
                              )}
                            </div>
                          )}

                          {disciplineTab === "red" && (
                            <div className="space-y-0.5">
                              {topRedCards.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-3 text-center">No red cards yet.</div>
                              ) : (
                                topRedCards.map((p, i) => (
                                  <StatBarRow
                                    key={p.name + p.team}
                                    rank={i + 1}
                                    label={p.name}
                                    sublabel={p.team}
                                    value={p.redCards}
                                    maxValue={topRedCards[0]?.redCards ?? 1}
                                    color="bg-red-500"
                                    icon={<div className="w-2.5 h-3 rounded-[1px] bg-red-500" />}
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* ---- TEAMS VIEW ---- */}
                  {statsView === "teams" && (
                    <div className="grid gap-6 sm:grid-cols-2">
                      {teamsByGoals.length > 0 && (
                        <div>
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                            Most goals
                          </div>
                          <div className="space-y-0.5">
                            {teamsByGoals.map((t, i) => (
                              <StatBarRow
                                key={t.team}
                                rank={i + 1}
                                label={t.team}
                                sublabel=""
                                value={t.goals}
                                maxValue={teamsByGoals[0]?.goals ?? 1}
                                color="bg-emerald-500"
                                logo={t.logoUrl}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {teamsByCS.length > 0 && (
                        <div>
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                            Most clean sheets
                          </div>
                          <div className="space-y-0.5">
                            {teamsByCS.map((t, i) => (
                              <StatBarRow
                                key={t.team}
                                rank={i + 1}
                                label={t.team}
                                sublabel=""
                                value={t.cleanSheets}
                                maxValue={teamsByCS[0]?.cleanSheets ?? 1}
                                color="bg-blue-500"
                                logo={t.logoUrl}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {teamsByAssists.length > 0 && (
                        <div>
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                            Most assists
                          </div>
                          <div className="space-y-0.5">
                            {teamsByAssists.map((t, i) => (
                              <StatBarRow
                                key={t.team}
                                rank={i + 1}
                                label={t.team}
                                sublabel=""
                                value={t.assists}
                                maxValue={teamsByAssists[0]?.assists ?? 1}
                                color="bg-violet-500"
                                logo={t.logoUrl}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Team Discipline */}
                      {(teamsByYC.length > 0 || teamsByRC.length > 0) && (
                        <div className="sm:col-span-2">
                          <div className="text-[11px] uppercase tracking-widest text-muted-foreground pb-2">
                            Discipline
                          </div>
                          <div className="flex gap-1 mb-3">
                            <button
                              type="button"
                              onClick={() => setDisciplineTab("yellow")}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                                disciplineTab === "yellow"
                                  ? "bg-yellow-400 text-yellow-900"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                            >
                              Yellow Cards
                            </button>
                            <button
                              type="button"
                              onClick={() => setDisciplineTab("red")}
                              className={cn(
                                "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
                                disciplineTab === "red"
                                  ? "bg-red-500 text-white"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                            >
                              Red Cards
                            </button>
                          </div>

                          {disciplineTab === "yellow" && (
                            <div className="space-y-0.5">
                              {teamsByYC.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-3 text-center">No yellow cards yet.</div>
                              ) : (
                                teamsByYC.map((t, i) => (
                                  <StatBarRow
                                    key={t.team}
                                    rank={i + 1}
                                    label={t.team}
                                    sublabel=""
                                    value={t.yellowCards}
                                    maxValue={teamsByYC[0]?.yellowCards ?? 1}
                                    color="bg-yellow-400"
                                    logo={t.logoUrl}
                                    icon={<div className="w-2.5 h-3 rounded-[1px] bg-yellow-400" />}
                                  />
                                ))
                              )}
                            </div>
                          )}

                          {disciplineTab === "red" && (
                            <div className="space-y-0.5">
                              {teamsByRC.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-3 text-center">No red cards yet.</div>
                              ) : (
                                teamsByRC.map((t, i) => (
                                  <StatBarRow
                                    key={t.team}
                                    rank={i + 1}
                                    label={t.team}
                                    sublabel=""
                                    value={t.redCards}
                                    maxValue={teamsByRC[0]?.redCards ?? 1}
                                    color="bg-red-500"
                                    logo={t.logoUrl}
                                    icon={<div className="w-2.5 h-3 rounded-[1px] bg-red-500" />}
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="h-24 md:hidden" />
    </div>
  );
}

export default function MatchesPage() {
  return (
    <React.Suspense fallback={<div className="mx-auto w-full max-w-md px-4 pt-10 text-sm text-muted-foreground">Loading...</div>}>
      <MatchesContent />
    </React.Suspense>
  );
}
