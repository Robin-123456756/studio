"use client";

import * as React from "react";
import Link from "next/link";
import { myFantasyTeam, fantasyStandings } from "@/lib/data";
import {
  ArrowDown,
  ArrowUp,
  Minus,
  ChevronRight,
} from "lucide-react";
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

function formatDeadlineShort(iso?: string | null) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";

  const s = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Kampala",
  }).format(d);

  return s;
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
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ padding: "16px 16px 10px" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>Budo League</div>
        <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>Your rank among rivals.</div>
      </div>

      <div style={{ padding: "0 12px 16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {fantasyStandings.map((t) => {
            const isMe = t.name === myFantasyTeam.name;
            const delta = t.points - myFantasyTeam.points;
            const trend = delta > 0 ? "up" : delta < 0 ? "down" : "same";
            const trendLabel = delta === 0 ? "Even" : `${delta > 0 ? "+" : ""}${delta}`;

            return (
              <div
                key={t.rank}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 14,
                  border: isMe ? "1.5px solid rgba(55,0,60,0.3)" : "1px solid #eee",
                  background: isMe ? "rgba(55,0,60,0.06)" : "#fff",
                  padding: "10px 14px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#888", width: 28, fontVariantNumeric: "tabular-nums" }}>
                    #{t.rank}
                  </div>
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", background: "#f0f0f0",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: "#555",
                    border: "1px solid #e0e0e0",
                  }}>
                    {getInitials(t.name)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.owner}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 4,
                    borderRadius: 20, padding: "3px 10px",
                    fontSize: 12, fontWeight: 600,
                    background: trend === "up" ? "rgba(16,185,129,0.12)" : trend === "down" ? "rgba(239,68,68,0.12)" : "#f0f0f0",
                    color: trend === "up" ? "#059669" : trend === "down" ? "#dc2626" : "#888",
                  }}>
                    {trend === "up" ? (
                      <ArrowUp style={{ width: 12, height: 12 }} />
                    ) : trend === "down" ? (
                      <ArrowDown style={{ width: 12, height: 12 }} />
                    ) : (
                      <Minus style={{ width: 12, height: 12 }} />
                    )}
                    {trendLabel}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, fontVariantNumeric: "tabular-nums", fontFamily: "monospace", color: "#1a1a2e" }}>
                    {t.points}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Navigation Row ──
function NavRow({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "18px 20px",
        background: "#fff",
        textDecoration: "none",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <span style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>{label}</span>
      <ChevronRight style={{ width: 20, height: 20, color: "#ccc" }} />
    </Link>
  );
}

// ── Main Fantasy Page ──
function StatTile({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-2xl border border-primary/30 bg-primary px-3 py-3 text-center text-primary-foreground"
          : "rounded-2xl border bg-muted/40 px-3 py-3 text-center"
      }
    >
      <div
        className={
          highlight
            ? "text-[11px] font-semibold uppercase tracking-widest text-primary-foreground/70"
            : "text-[11px] font-semibold uppercase tracking-widest text-muted-foreground"
        }
      >
        {label}
      </div>
      <div
        className={
          highlight
            ? "mt-1 text-2xl font-extrabold tabular-nums"
            : "mt-1 text-xl font-bold tabular-nums"
        }
      >
        {value}
      </div>
    </div>
  );
}

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

  const gwPointsValue = statsLoading ? "--" : stats.gwPoints ?? "--";
  const totalPointsValue = statsLoading ? "--" : stats.totalPoints ?? myFantasyTeam.points ?? "--";
  const overallRankValue = statsLoading ? "--" : stats.overallRank ?? myFantasyTeam.rank ?? "--";
  const gwRankValue = statsLoading ? "--" : stats.gwRank ?? "--";

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

  // Average & Highest are placeholders — replace with real data when available

  return (
    <div style={{
      maxWidth: 430,
      margin: "0 auto",
      background: "#f2f2f2",
      fontFamily: "'Outfit', 'DM Sans', -apple-system, sans-serif",
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
      position: "relative",
    }}>
      <div className="space-y-4 px-4 pt-4">
        <Card className="rounded-3xl overflow-hidden border-none">
          <CardContent className="p-0">
            <div className="relative overflow-hidden p-5 bg-gradient-to-br from-primary via-primary/90 to-primary/70">
              <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/5" />
              <div className="pointer-events-none absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-white/5" />

              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm/none text-primary-foreground/60">Season</div>
                  <div className="mt-2 text-2xl font-extrabold tracking-tight text-primary-foreground">
                    TBL9
                  </div>
                </div>

                <button
                  type="button"
                  onClick={editTeamName}
                  className="text-right"
                >
                  <div className="text-base font-bold text-primary-foreground">
                    {teamName}
                  </div>
                  <div className="text-xs text-primary-foreground/70">
                    {myFantasyTeam.owner}
                  </div>
                  <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary-foreground/70">
                    Edit team
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Fantasy score
                </div>
                <div className="text-lg font-extrabold">
                  {gwLoading ? "Loading..." : `Gameweek ${currentGW?.id ?? "--"}`}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Next deadline
                </div>
                <div className="text-sm font-semibold">
                  {gwLoading ? "Loading..." : formatDeadlineShort(nextGW?.deadline_time)}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <StatTile label="GW points" value={gwPointsValue} highlight />
              <StatTile label="Total points" value={totalPointsValue} />
              <StatTile label="GW rank" value={gwRankValue} />
              <StatTile label="Overall rank" value={overallRankValue} />
            </div>

            {deadlineCountdown.tone !== "neutral" && (
              <div className="flex justify-center">
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${deadlinePillClass}`}
                >
                  {deadlineCountdown.tone === "closed"
                    ? "Deadline closed"
                    : `Deadline in ${deadlineCountdown.label}`}
                </span>
              </div>
            )}

            {gwError && (
              <div className="text-center text-xs text-muted-foreground">
                {gwError}
              </div>
            )}
            {statsError && (
              <div className="text-center text-xs text-muted-foreground">
                {statsError}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href="/dashboard/fantasy/pick-team"
                className="rounded-2xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                Pick Team
              </Link>
              <Link
                href="/dashboard/transfers"
                className="rounded-2xl border border-primary/30 bg-background px-4 py-3 text-center text-sm font-semibold text-foreground transition hover:border-primary/50"
              >
                Transfers
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* NAVIGATION SECTIONS */}
      <div style={{ marginTop: 16, padding: "0 16px" }}>
        <div style={{ borderRadius: 16, overflow: "hidden", margin: "0 0px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <NavRow label="Fixtures" href="/dashboard/schedule" />
          {/* <NavRow label="Fixture Difficulty Rating" href="/dashboard/schedule" /> */}
          <NavRow label="Player Statistics" href="/dashboard/players" />
          <NavRow label="Set Piece Taker" href="/dashboard/players" />
        </div>
      </div>

      {/* ═══ MINI LEAGUE ═══ */}
      <div style={{ padding: "16px 16px" }}>
        <MiniLeague />
      </div>
    </div>
  );
}

/** AUTH WRAPPER */
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
