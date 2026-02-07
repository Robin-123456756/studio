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

  // Average & Highest are placeholders — replace with real data when available
  const averagePoints = 55;
  const highestPoints = 126;

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
      {/* ═══ HERO SECTION ═══ */}
      <div style={{
        background: "linear-gradient(135deg, #DC143C 0%, #8B0000 20%, #1a0a0a 45%, #2a1a00 70%, #D4A843 90%, #FFD700 100%)",
        padding: "0 0 24px",
        position: "relative",
        overflow: "hidden",
        borderRadius: "0 0 24px 24px",
      }}>
        {/* Abstract swirl decoration */}
        <div style={{
          position: "absolute", top: -40, right: -60,
          width: 280, height: 380,
          background: "linear-gradient(160deg, transparent 20%, rgba(255,215,0,0.12) 40%, rgba(212,168,67,0.18) 60%, rgba(255,215,0,0.08) 80%)",
          borderRadius: "40% 60% 70% 30% / 40% 50% 60% 50%",
          transform: "rotate(-15deg)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: 80, right: -30,
          width: 200, height: 300,
          background: "linear-gradient(180deg, rgba(255,215,0,0.06), rgba(212,168,67,0.12))",
          borderRadius: "60% 40% 30% 70% / 50% 60% 40% 50%",
          transform: "rotate(25deg)",
          pointerEvents: "none",
        }} />

        {/* ── Team Info Row ── */}
        <button
          type="button"
          onClick={editTeamName}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px 14px",
            gap: 12,
            background: "none",
            border: "none",
            cursor: "pointer",
            width: "100%",
            textAlign: "left",
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ color: "#fff", fontSize: 18, fontWeight: 800 }}>{teamName}</div>
            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontWeight: 500, marginTop: 2 }}>
              {myFantasyTeam.owner}
            </div>
          </div>

          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <path d="M9 6l6 6-6 6" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* ── Divider ── */}
        <div style={{ width: 60, height: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 14px", borderRadius: 1 }} />

        {/* ── Gameweek Label ── */}
        <div style={{ textAlign: "center", color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
          {gwLoading ? "Loading..." : `Gameweek ${currentGW?.id ?? "--"}`}
        </div>

        {/* ── Points Row ── */}
        <div style={{
          display: "flex", alignItems: "flex-end", justifyContent: "center",
          padding: "0 20px 16px", gap: 0,
        }}>
          {/* Average */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "rgba(255,255,255,0.75)", lineHeight: 1 }}>
              {averagePoints}
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600, marginTop: 4 }}>Average</div>
          </div>

          {/* Points (larger, center) */}
          <div style={{ flex: 1.2, textAlign: "center" }}>
            <div style={{ fontSize: 52, fontWeight: 900, color: "#fff", lineHeight: 1 }}>
              {gwPointsValue}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 13, color: "#FFD700", fontWeight: 700 }}>Points</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 6l6 6-6 6" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* Highest */}
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "rgba(255,255,255,0.75)", lineHeight: 1 }}>
              {highestPoints}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>Highest</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M9 6l6 6-6 6" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div style={{ width: 60, height: 2, background: "rgba(255,255,255,0.2)", margin: "0 auto 14px", borderRadius: 1 }} />

        {/* ── Next Gameweek Deadline ── */}
        <div style={{ textAlign: "center", marginBottom: 6 }}>
          <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: 600 }}>
            {gwLoading ? "" : `Gameweek ${nextGW?.id ?? (currentGW?.id ? (currentGW.id + 1) : "--")}`}
          </div>
          <div style={{ color: "#fff", fontSize: 17, fontWeight: 800, marginTop: 4 }}>
            {gwLoading
              ? "Loading..."
              : `Deadline: ${formatDeadlineShort(nextGW?.deadline_time)}`}
          </div>
          {deadlineCountdown.tone !== "neutral" && deadlineCountdown.tone !== "closed" && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 8, padding: "4px 14px",
              borderRadius: 20,
              background:
                deadlineCountdown.tone === "critical" ? "rgba(239,68,68,0.4)" :
                deadlineCountdown.tone === "urgent" ? "rgba(239,68,68,0.3)" :
                deadlineCountdown.tone === "soon" ? "rgba(245,158,11,0.3)" :
                "rgba(255,255,255,0.12)",
              fontSize: 12, fontWeight: 700, color: "#fff",
            }}>
              {deadlineCountdown.label}
            </div>
          )}
          {deadlineCountdown.tone === "closed" && (
            <div style={{
              display: "inline-flex", marginTop: 8, padding: "4px 14px",
              borderRadius: 20, background: "rgba(255,255,255,0.1)",
              fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.7)",
            }}>
              Deadline closed
            </div>
          )}
        </div>

        {gwError && (
          <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 4 }}>
            {gwError}
          </div>
        )}
        {statsError && (
          <div style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
            {statsError}
          </div>
        )}

        {/* ── CTA Buttons ── */}
        <div style={{ padding: "14px 20px 0", display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Pick Team */}
          <Link
            href="/dashboard/fantasy/pick-team"
            style={{
              width: "100%", padding: "14px 0",
              background: "linear-gradient(90deg, rgba(255,215,0,0.2), rgba(212,168,67,0.12))",
              border: "1.5px solid rgba(255,255,255,0.2)",
              borderRadius: 28, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              backdropFilter: "blur(8px)",
              textDecoration: "none",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L9 9H2l6 4.5L5.5 22 12 17l6.5 5-2.5-8.5L22 9h-7L12 2z" stroke="#fff" strokeWidth="1.5" fill="rgba(255,255,255,0.15)" />
            </svg>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Pick Team</span>
          </Link>

          {/* Transfers */}
          <Link
            href="/dashboard/transfers"
            style={{
              width: "100%", padding: "14px 0",
              background: "linear-gradient(90deg, rgba(255,215,0,0.2), rgba(212,168,67,0.12))",
              border: "1.5px solid rgba(255,255,255,0.2)",
              borderRadius: 28, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              backdropFilter: "blur(8px)",
              textDecoration: "none",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>Transfers</span>
          </Link>
        </div>
      </div>

      {/* ═══ NAVIGATION SECTIONS ═══ */}
      <div style={{ marginTop: 16 }}>
        <div style={{ borderRadius: 16, overflow: "hidden", margin: "0 0px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <NavRow label="Fixtures" href="/dashboard/schedule" />
          {/* <NavRow label="Fixture Difficulty Rating" href="/dashboard/schedule" /> */}
          <NavRow label="Player Statistics" href="/dashboard/players" />
          <NavRow label="Set Piece Taker" href="/dashboard/players" />
        </div>
      </div>

      {/* ═══ MINI LEAGUE ═══ */}
      <div style={{ padding: "16px 0px" }}>
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
