"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { myFantasyTeam, fantasyStandings } from "@/lib/data";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  Shirt,
  ArrowLeftRight,
  Clock,
  Flame,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";

type Player = {
  id: string;
  name: string; // full name
  webName?: string | null; // short display name
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward" | string;
  price: number;
  points: number;
  avatarUrl?: string | null;
  isLady?: boolean;
  teamShort?: string | null;
  teamName?: string | null;
  didPlay?: boolean;
};

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

const LS_PICKS = "tbl_picked_player_ids";

function formatDeadlineUG(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);

  const s = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  }).format(d);

  return s
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM")
    .replace(/\ba\.m\.\b/i, "AM")
    .replace(/\bp\.m\.\b/i, "PM");
}

function normalizePosition(pos?: string | null): Player["position"] {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "Goalkeeper";
  if (p === "def" || p === "df" || p === "defender") return "Defender";
  if (p === "mid" || p === "mf" || p === "midfielder") return "Midfielder";
  if (p === "fwd" || p === "fw" || p === "forward" || p === "striker") return "Forward";
  return pos ?? "Midfielder";
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

function StatCard({
  label,
  value,
  sublabel,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-white shadow-sm",
        highlight && "bg-white/20"
      )}
    >
      <div className="text-xs uppercase tracking-widest text-white/70">{label}</div>
      <div className={cn("mt-1 text-2xl font-extrabold tabular-nums", highlight && "text-3xl")}>
        {value}
      </div>
      {sublabel ? <div className="mt-1 text-xs text-white/70">{sublabel}</div> : null}
    </div>
  );
}

function MiniLeague() {
  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="p-0">
        <div className="px-4 pt-4 pb-2">
          <div className="text-base font-semibold">Budo League</div>
          <div className="text-sm text-muted-foreground">Your rank among rivals.</div>
        </div>

        <div className="px-3 pb-4">
          <div className="space-y-2">
            {fantasyStandings.map((t) => {
              const isMe = t.name === myFantasyTeam.name;
              const delta = t.points - myFantasyTeam.points;
              const trend = delta > 0 ? "up" : delta < 0 ? "down" : "same";
              const trendLabel = delta === 0 ? "Even" : `${delta > 0 ? "+" : ""}${delta}`;

              return (
                <div
                  key={t.rank}
                  className={cn(
                    "flex items-center justify-between rounded-2xl border border-border/40 bg-card px-3 py-2 shadow-sm transition",
                    isMe && "border-primary/40 bg-primary/10"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-xs font-semibold text-muted-foreground tabular-nums w-8">
                      #{t.rank}
                    </div>
                    <Avatar className="size-9 border border-border/60">
                      <AvatarImage src="" alt={t.name} />
                      <AvatarFallback className="bg-muted text-xs font-semibold">
                        {getInitials(t.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.owner}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold",
                        trend === "up" && "bg-emerald-500/15 text-emerald-600",
                        trend === "down" && "bg-rose-500/15 text-rose-600",
                        trend === "same" && "bg-muted text-muted-foreground"
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

                    <div className="text-sm font-bold font-mono tabular-nums">{t.points}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** ✅ Your actual fantasy main UI (only shows Pick Team / Transfers) */
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

  // (Optional) You can later replace this with DB-loaded team name
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
  }>({
    gwPoints: null,
    totalPoints: null,
    overallRank: null,
    gwRank: null,
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

      setStats({
        gwPoints,
        totalPoints,
        overallRank,
        gwRank,
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

  const gwPointsValue = statsLoading ? "..." : stats.gwPoints ?? "—";
  const totalPointsValue =
    statsLoading ? "..." : stats.totalPoints ?? myFantasyTeam.points ?? "—";
  const overallRankValue =
    statsLoading ? "..." : stats.overallRank ?? myFantasyTeam.rank ?? "—";
  const gwRankValue = statsLoading ? "..." : stats.gwRank ?? "—";

  const countdownToneClass = cn(
    "inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
    deadlineCountdown.tone === "critical" && "bg-rose-600/40 text-white",
    deadlineCountdown.tone === "urgent" && "bg-rose-500/35 text-white",
    deadlineCountdown.tone === "soon" && "bg-amber-400/30 text-white",
    deadlineCountdown.tone === "normal" && "bg-white/15 text-white/90",
    deadlineCountdown.tone === "closed" && "bg-white/10 text-white/70",
    deadlineCountdown.tone === "neutral" && "bg-white/10 text-white/70"
  );

  return (
    <div className="space-y-5 animate-in fade-in-50">
      {/* Top card */}
      <div
        className={cn(
          "rounded-3xl overflow-hidden",
          "bg-gradient-to-br from-rose-700 via-red-600 to-orange-500"
        )}
      >
        <div className="p-4 text-white">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <button
                type="button"
                onClick={editTeamName}
                className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 hover:bg-white/15 active:bg-white/20"
                aria-label="Edit team name"
              >
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/20">
                  <Shirt className="h-6 w-6" />
                </div>
                <div className="text-left">
                  <div className="text-xl font-bold leading-tight">{teamName}</div>
                  <div className="text-sm text-white/80">{myFantasyTeam.owner}</div>
                </div>
              </button>

              <div className="text-right">
                <div className="text-xs uppercase tracking-widest text-white/70">Current GW</div>
                <div className="text-lg font-semibold">
                  {gwLoading ? "GW ..." : `GW ${currentGW?.id ?? "—"}`}
                </div>
                <div className="mt-2 flex justify-end">
                  <span className={countdownToneClass}>
                    {deadlineCountdown.tone === "critical" ||
                    deadlineCountdown.tone === "urgent" ? (
                      <Flame className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                    {deadlineCountdown.tone === "closed"
                      ? "Deadline closed"
                      : `Deadline in ${deadlineCountdown.label}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Your GW Points"
                value={gwPointsValue}
                sublabel="Live from your picks"
                highlight
              />
              <StatCard
                label="Overall Rank"
                value={overallRankValue}
                sublabel="Budo League"
              />
              <StatCard
                label="Total Points"
                value={totalPointsValue}
                sublabel="Season total"
              />
              <StatCard
                label="Gameweek Rank"
                value={gwRankValue}
                sublabel={`GW ${currentGW?.id ?? "—"}`}
              />
            </div>

            <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/85">
              <div className="text-xs uppercase tracking-widest text-white/70">Next deadline</div>
              <div className="mt-1 text-base font-semibold">
                {gwLoading ? "Loading..." : formatDeadlineUG(nextGW?.deadline_time)}
              </div>
              {gwError ? <div className="mt-2 text-xs text-white/80">⚠ {gwError}</div> : null}
              {statsError ? <div className="mt-1 text-xs text-white/80">⚠ {statsError}</div> : null}
            </div>

            <div className="space-y-3">
              <Button
                asChild
                className="w-full rounded-2xl bg-white/15 text-white hover:bg-white/20"
                variant="secondary"
              >
                <Link href="/dashboard/fantasy/pick-team">
                  <span className="flex items-center justify-center gap-2">
                    <Shirt className="h-5 w-5" /> Pick Team
                  </span>
                </Link>
              </Button>

              <Button
                asChild
                className="w-full rounded-2xl bg-white/15 text-white hover:bg-white/20"
                variant="secondary"
              >
                <Link href="/dashboard/transfers">
                  <span className="flex items-center justify-center gap-2">
                    <ArrowLeftRight className="h-5 w-5" /> Transfers
                  </span>
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <MiniLeague />
    </div>
  );
}

/** ✅ AUTH WRAPPER (this is what renders at /dashboard/fantasy) */
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
    // AuthGate should handle sign in + sign up then call onAuthed
    return <AuthGate onAuthed={() => setAuthed(true)} />;
  }

  return <FantasyPage />;
}
