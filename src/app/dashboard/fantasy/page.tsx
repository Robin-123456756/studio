"use client";

import * as React from "react";
import Link from "next/link";
import { myFantasyTeam, fantasyStandings } from "@/lib/data";
import {
  ArrowDown,
  ArrowUp,
  ArrowLeftRight,
  Minus,
  ChevronRight,
  Users,
  Shirt,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { Card, CardContent } from "@/components/ui/card";

type ApiGameweek = {
  id: number;
  name?: string | null;
  deadline_time?: string | null;
  finalized?: boolean | null;
};

type ApiPlayer = {
  id: string;
  name: string;
  webName?: string | null;
  position?: string | null;
  price?: number | null;
  points?: number | null;
  avatarUrl?: string | null;
  isLady?: boolean | null;
  teamShort?: string | null;
  teamName?: string | null;
};

const menuItems = [
  { label: "Fixtures", href: "/dashboard/schedule" },
  { label: "Player Statistics", href: "/dashboard/players" },
  { label: "Set Piece Taker", href: "/dashboard/players" },
];

function formatDeadlineShort(iso?: string | null) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
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

function getInitials(value: string) {
  return value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

function useDeadlineCountdown(deadlineIso?: string | null) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!deadlineIso) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadlineIso]);

  if (!deadlineIso) {
    return { label: "TBA", msLeft: null, tone: "neutral" as const };
  }

  const msLeft = new Date(deadlineIso).getTime() - now;
  if (Number.isNaN(msLeft)) {
    return { label: "TBA", msLeft: null, tone: "neutral" as const };
  }

  if (msLeft <= 0) {
    return { label: "Closed", msLeft: 0, tone: "closed" as const };
  }

  const hoursLeft = msLeft / 3600000;
  const tone =
    hoursLeft <= 1 ? "critical" : hoursLeft <= 6 ? "urgent" : hoursLeft <= 24 ? "soon" : "normal";

  return { label: formatCountdown(msLeft), msLeft, tone };
}

// ── Mini League ──
function MiniLeague() {
  return (
    <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
      <CardContent className="p-4">
        <div className="text-base font-semibold text-foreground">Budo League</div>
        <div className="mt-1 text-xs text-muted-foreground">Your rank among rivals.</div>
      </CardContent>

      <div className="space-y-2 px-3 pb-4">
        {fantasyStandings.map((t) => {
          const isMe = t.name === myFantasyTeam.name;
          const delta = t.points - myFantasyTeam.points;
          const trend = delta > 0 ? "up" : delta < 0 ? "down" : "same";
          const trendLabel = delta === 0 ? "Even" : `${delta > 0 ? "+" : ""}${delta}`;
          const trendClass =
            trend === "up"
              ? "bg-emerald-500/10 text-emerald-600"
              : trend === "down"
              ? "bg-red-500/10 text-red-600"
              : "bg-muted/70 text-muted-foreground";

          return (
            <div
              key={t.rank}
              className={cn(
                "flex items-center justify-between rounded-xl border px-3 py-2",
                isMe ? "border-primary/30 bg-primary/5" : "border-border bg-card"
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-7 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                  #{t.rank}
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-xs font-bold text-foreground">
                  {getInitials(t.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-foreground">
                    {t.name}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {t.owner}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                    trendClass
                  )}
                >
                  {trend === "up" ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : trend === "down" ? (
                    <ArrowDown className="h-3 w-3" />
                  ) : (
                    <Minus className="h-3 w-3" />
                  )}
                  {trendLabel}
                </div>
                <div className="text-sm font-bold tabular-nums text-foreground">
                  {t.points}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Navigation Row ──
function NavRow({
  label,
  href,
  isLast,
}: {
  label: string;
  href: string;
  isLast?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between px-5 py-4 text-sm font-semibold text-foreground transition hover:bg-muted/40",
        !isLast && "border-b border-border"
      )}
    >
      <span>{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </Link>
  );
}

// ── Main Fantasy Page ──
function FantasyPage() {
  const [currentGW, setCurrentGW] = React.useState<ApiGameweek | null>(null);
  const [nextGW, setNextGW] = React.useState<ApiGameweek | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);
  const [gwError, setGwError] = React.useState<string | null>(null);

  // Load gameweeks
  React.useEffect(() => {
    (async () => {
      try {
        setGwLoading(true);
        setGwError(null);

        const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load gameweeks");

        setCurrentGW(json.current ?? null);
        setNextGW(json.next ?? null);
      } catch (e: any) {
        setGwError(e?.message || "Unknown error");
      } finally {
        setGwLoading(false);
      }
    })();
  }, []);

  const [teamName, setTeamName] = React.useState(myFantasyTeam.name);

  function editTeamName() {
    const next = window.prompt("Enter your team name:", teamName);
    if (!next) return;
    const cleaned = next.trim().slice(0, 30);
    if (!cleaned) return;
    setTeamName(cleaned);
    window.localStorage.setItem("tbl_team_name", cleaned);
  }

  React.useEffect(() => {
    const savedName = window.localStorage.getItem("tbl_team_name");
    if (savedName && savedName.trim().length > 0) setTeamName(savedName);
  }, []);

  const [stats, setStats] = React.useState<{
    gwPoints: number | null;
    totalPoints: number | null;
    overallRank: number | null;
    gwRank: number | null;
    avgPoints: number | null;
    highestPoints: number | null;
  }>({
    gwPoints: null,
    totalPoints: null,
    overallRank: null,
    gwRank: null,
    avgPoints: null,
    highestPoints: null,
  });
  const [statsLoading, setStatsLoading] = React.useState(true);
  const [statsError, setStatsError] = React.useState<string | null>(null);

  const deadlineCountdown = useDeadlineCountdown(nextGW?.deadline_time);

  const loadStats = React.useCallback(async () => {
    try {
      setStatsLoading(true);
      setStatsError(null);

      const sessionRes = await supabase.auth.getSession();
      const userId = sessionRes.data.session?.user.id;
      if (!userId) {
        setStatsLoading(false);
        return;
      }

      const rosterRes = await fetch(`/api/rosters/current?user_id=${userId}`, {
        cache: "no-store",
      });
      const rosterJson = await rosterRes.json();
      if (!rosterRes.ok) throw new Error(rosterJson?.error || "Failed to load roster");

      const squadIds: string[] = rosterJson?.squadIds ?? [];
      const startingIds: string[] =
        rosterJson?.startingIds?.length > 0 ? rosterJson.startingIds : squadIds;

      if (squadIds.length === 0) {
        setStatsLoading(false);
        return;
      }

      const playersRes = await fetch(`/api/players?ids=${squadIds.join(",")}`, {
        cache: "no-store",
      });
      const playersJson = await playersRes.json();
      if (!playersRes.ok) throw new Error(playersJson?.error || "Failed to load players");

      const players: ApiPlayer[] = playersJson.players ?? [];
      const pointsById = new Map(
        players.map((p) => [String(p.id), Number(p.points ?? 0)])
      );

      const baseGwPoints = startingIds.reduce(
        (sum, id) => sum + (pointsById.get(String(id)) ?? 0),
        0
      );
      const captainId = rosterJson?.captainId ?? null;
      const gwPoints =
        baseGwPoints + (captainId ? pointsById.get(String(captainId)) ?? 0 : 0);

      let totalPoints = squadIds.reduce(
        (sum, id) => sum + (pointsById.get(String(id)) ?? 0),
        0
      );

      let overallRank: number | null = null;
      let gwRank: number | null = null;

      try {
        const { data: teamRow, error: teamErr } = await supabase
          .from("fantasy_teams")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (!teamErr && teamRow) {
          const dbTotal =
            Number((teamRow as any).total_points ?? (teamRow as any).points ?? NaN);
          if (Number.isFinite(dbTotal)) totalPoints = dbTotal;
          const dbOverall = Number(
            (teamRow as any).overall_rank ?? (teamRow as any).rank ?? NaN
          );
          const dbGw = Number(
            (teamRow as any).gameweek_rank ?? (teamRow as any).gw_rank ?? NaN
          );
          overallRank = Number.isFinite(dbOverall) ? dbOverall : null;
          gwRank = Number.isFinite(dbGw) ? dbGw : null;
        }
      } catch {
        // Ignore if the table/columns aren't available yet.
      }

      // Fetch all fantasy teams for average & highest
      let avgPoints: number | null = null;
      let highestPoints: number | null = null;
      try {
        const { data: allTeams } = await supabase
          .from("fantasy_teams")
          .select("user_id, total_points, points");
        if (allTeams && allTeams.length > 0) {
          const otherPts = allTeams
            .filter((t: any) => t.user_id !== userId)
            .map((t: any) => Number(t.total_points ?? t.points ?? 0))
            .filter((n: number) => Number.isFinite(n));
          if (otherPts.length > 0) {
            avgPoints = Math.round(otherPts.reduce((a: number, b: number) => a + b, 0) / otherPts.length);
            highestPoints = Math.max(...otherPts);
          }
        }
      } catch {
        // Ignore if table unavailable
      }

      setStats({
        gwPoints,
        totalPoints,
        overallRank,
        gwRank,
        avgPoints,
        highestPoints,
      });
    } catch (e: any) {
      setStatsError(e?.message || "Failed to load stats");
    } finally {
      setStatsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadStats();
    const timer = window.setInterval(loadStats, 30000);
    return () => window.clearInterval(timer);
  }, [loadStats]);

  const gwPointsValue = statsLoading ? "--" : stats.gwPoints ?? "--";
  const avgPointsValue = statsLoading ? "--" : stats.avgPoints ?? "--";
  const highestPointsValue = statsLoading ? "--" : stats.highestPoints ?? "--";

  const deadlinePillClass =
    deadlineCountdown.tone === "critical"
      ? "bg-red-500/15 text-red-600"
      : deadlineCountdown.tone === "urgent"
      ? "bg-orange-500/15 text-orange-600"
      : deadlineCountdown.tone === "soon"
      ? "bg-amber-500/15 text-amber-700"
      : deadlineCountdown.tone === "normal"
      ? "bg-muted/70 text-muted-foreground"
      : "bg-muted text-muted-foreground";

  return (
    <div className="mx-auto w-full max-w-app min-h-screen bg-muted/30 font-body flex flex-col">
        <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
        <div
          className={cn(
            "overflow-hidden rounded-b-3xl",
            "bg-[#B8923A]",
            "shadow-[0_8px_30px_rgba(180,155,80,0.35)]"
          )}
        >
          <div className="p-4 text-white">
          <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={editTeamName}
            className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 hover:bg-white/15 active:bg-white/20"
            aria-label="Edit team name"
          >
            <div className="h-12 w-12 rounded-2xl bg-white/20 grid place-items-center">
              <Shirt className="h-6 w-6" />
            </div>

            <div className="flex-1">
              <div className="text-base font-extrabold">{teamName}</div>
              <div className="mt-1 text-xs text-white/70">{myFantasyTeam.owner}</div>
            </div>
          </button>

            <ChevronRight className="h-5 w-5 text-white/70" />
          </div>

          <div className="mx-auto my-4 h-0.5 w-14 rounded-full bg-white/20" />

          <div className="text-center text-xs font-semibold text-white/70">
            {gwLoading ? "Loading..." : `Gameweek ${currentGW?.id ?? "--"}`}
          </div>

          <div className="flex items-end justify-center gap-0 px-5 pb-4 pt-2">
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-white/80 tabular-nums">
                {avgPointsValue}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-white/60">
                Average
              </div>
            </div>

            <div className="flex-[1.2] text-center">
              <div className="text-4xl font-extrabold tabular-nums">
                {gwPointsValue}
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold">
                GW points
                <ChevronRight className="h-3.5 w-3.5 text-white/80" />
              </div>
            </div>

            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-white/80 tabular-nums">
                {highestPointsValue}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-white/60">
                Highest
              </div>
            </div>
          </div>

          <div className="mx-auto mb-3 h-0.5 w-14 rounded-full bg-white/20" />

          <div className="text-center text-xs font-semibold text-white/70">
            {gwLoading
              ? ""
              : `Gameweek ${nextGW?.id ?? (currentGW?.id ? currentGW.id + 1 : "--")}`}
          </div>
          <div className="mt-1 text-center text-sm font-bold">
            {gwLoading
              ? "Loading..."
              : `Deadline: ${formatDeadlineShort(nextGW?.deadline_time)}`}
          </div>

          {deadlineCountdown.tone !== "neutral" && (
            <div className="mt-2 flex justify-center">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                  deadlinePillClass
                )}
              >
                {deadlineCountdown.tone === "closed"
                  ? "Deadline closed"
                  : `Deadline in ${deadlineCountdown.label}`}
              </span>
            </div>
          )}

          {gwError && (
            <div className="mt-2 text-center text-xs text-white/70">
              {gwError}
            </div>
          )}
          {statsError && (
            <div className="mt-1 text-center text-xs text-white/70">
              {statsError}
            </div>
          )}
          </div>

          <div className="grid grid-cols-2 gap-0 border-t border-white/15 text-white">
            <Link
              href="/dashboard/fantasy/pick-team"
              className="flex flex-col items-center gap-1 border-r border-white/15 py-4 transition hover:bg-white/10 rounded-bl-3xl"
            >
              <Users className="h-5 w-5" />
              <span className="text-[11px] font-semibold">Pick Team</span>
            </Link>
            <Link
              href="/dashboard/transfers"
              className="flex flex-col items-center gap-1 py-4 transition hover:bg-white/10 rounded-br-3xl"
            >
              <ArrowLeftRight className="h-5 w-5" />
              <span className="text-[11px] font-semibold">Transfers</span>
            </Link>
          </div>
        </div>
        </div>

      <div className="mt-4">
        <div className="overflow-hidden rounded-2xl bg-card shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
          {menuItems.map((item, i) => (
            <NavRow
              key={item.label}
              label={item.label}
              href={item.href}
              isLast={i === menuItems.length - 1}
            />
          ))}
        </div>
      </div>

      <div className="py-4">
        <MiniLeague />
      </div>
    </div>
  );
}

export default function FantasyRoute() {
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 text-sm text-muted-foreground">
        Checking session...
      </div>
    );
  }

  if (!authed) {
    return <AuthGate onAuthed={() => setAuthed(true)} />;
  }

  return <FantasyPage />;
}
