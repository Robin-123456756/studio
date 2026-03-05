"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  ChevronRight,
  Users,
  Shirt,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { TeamNameModal } from "@/components/TeamNameModal";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ApiGameweek = {
  id: number;
  name?: string | null;
  deadline_time?: string | null;
  finalized?: boolean | null;
};

const menuItems = [
  { label: "Leagues", href: "/dashboard/fantasy/leagues" },
  { label: "Fixtures", href: "/dashboard/fixtures" },
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

type LeaderboardEntry = {
  rank: number;
  userId: string;
  teamName: string;
  totalPoints: number;
  gwBreakdown: Record<number, number>;
};

function miniRankLabel(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

function miniRankColor(rank: number) {
  if (rank === 1) return "text-amber-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-700";
  return "text-muted-foreground";
}

function MiniLeague() {
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [userId, setUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user.id ?? null);
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/fantasy-leaderboard", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await res.json();
        if (!res.ok) throw new Error();
        setEntries(json.leaderboard ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const top3 = entries.slice(0, 3);
  const userInTop3 = top3.some((e) => e.userId === userId);
  const userEntry = entries.find((e) => e.userId === userId);

  return (
    <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <div className="text-base font-semibold text-foreground">Budo League</div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Your rank among rivals.</div>
      </CardContent>

      <div className="px-3 pb-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        ) : error || entries.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No league standings yet. Data will appear once gameweeks are played.
          </div>
        ) : (
          <div className="space-y-1">
            {top3.map((entry) => {
              const isUser = entry.userId === userId;
              return (
                <div
                  key={entry.userId}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                    isUser && "bg-[#0D5C63]/10"
                  )}
                >
                  <span className={cn("w-6 font-bold text-center", miniRankColor(entry.rank))}>
                    {miniRankLabel(entry.rank)}
                  </span>
                  <span className="flex-1 font-medium truncate">{entry.teamName}</span>
                  <span className="font-bold tabular-nums">{entry.totalPoints}</span>
                </div>
              );
            })}

            {!userInTop3 && userEntry && (
              <>
                <div className="border-t border-dashed border-border my-1" />
                <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-[#0D5C63]/10">
                  <span className={cn("w-6 font-bold text-center", miniRankColor(userEntry.rank))}>
                    {userEntry.rank}
                  </span>
                  <span className="flex-1 font-medium truncate">{userEntry.teamName}</span>
                  <span className="font-bold tabular-nums">{userEntry.totalPoints}</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {!loading && !error && entries.length > 0 && (
        <Link
          href="/dashboard/fantasy/leaderboard"
          className="flex items-center justify-center gap-1 border-t border-border py-3 text-sm font-semibold text-[#0D5C63] hover:bg-muted/40 transition rounded-b-2xl"
        >
          View Full Leaderboard
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
    </Card>
  );
}

// ── Recent Transfers ──

type TransferFeedItem = {
  id: number;
  managerTeam: string;
  playerOut: { webName: string };
  playerIn: { webName: string };
  createdAt: string;
};

function transferTimeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function RecentTransfers() {
  const [transfers, setTransfers] = React.useState<TransferFeedItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/transfers/activity?limit=5", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await res.json();
        if (!res.ok) throw new Error();
        setTransfers(json.transfers ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4 text-emerald-500" />
          <div className="text-base font-semibold text-foreground">Recent Transfers</div>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Latest moves</div>
      </CardContent>

      <div className="px-3 pb-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        ) : error || transfers.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            No transfers yet.
          </div>
        ) : (
          <div className="space-y-1">
            {transfers.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
              >
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-medium">{t.managerTeam}:</span>{" "}
                  <span className="text-red-500">{t.playerOut.webName}</span>
                  <span className="text-muted-foreground/60 mx-1">&rarr;</span>
                  <span className="text-emerald-600">{t.playerIn.webName}</span>
                </span>
                <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap flex-shrink-0">
                  {transferTimeAgo(t.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loading && !error && transfers.length > 0 && (
        <Link
          href="/dashboard/fantasy/transfers-activity"
          className="flex items-center justify-center gap-1 border-t border-border py-3 text-sm font-semibold text-[#0D5C63] hover:bg-muted/40 transition rounded-b-2xl"
        >
          View All Transfers
          <ChevronRight className="h-4 w-4" />
        </Link>
      )}
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

  const [teamName, setTeamName] = React.useState("My Team");
  const [showTeamNameModal, setShowTeamNameModal] = React.useState(false);

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

  const deadlineGameweek = currentGW ?? nextGW ?? null;
  const deadlineCountdown = useDeadlineCountdown(deadlineGameweek?.deadline_time);

  // Track which GW the displayed points are for
  const [displayedGwId, setDisplayedGwId] = React.useState<number | null>(null);

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

      let gwPoints = 0;
      let totalPoints = 0;
      let overallRank: number | null = null;
      let gwRank: number | null = null;
      let avgPoints: number | null = null;
      let highestPoints: number | null = null;

      // ── 1. Leaderboard — single source of truth for totalPoints + rank ──
      try {
        const lbRes = await fetch("/api/fantasy-leaderboard", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (lbRes.ok) {
          const lbJson = await lbRes.json();
          const lb: { userId: string; totalPoints: number; rank: number }[] =
            lbJson?.leaderboard ?? [];
          const myEntry = lb.find((e) => e.userId === userId);
          if (myEntry) {
            totalPoints = myEntry.totalPoints;
            overallRank = myEntry.rank;
          }
        }
      } catch {
        // non-fatal
      }

      // ── 2. GW points, avg, highest from user_weekly_scores ──
      try {
        const { data: allScores } = await supabase
          .from("user_weekly_scores")
          .select("user_id, gameweek_id, total_weekly_points");

        if (allScores && allScores.length > 0) {
          const targetGwId = Number(currentGW?.id ?? NaN);

          // Find the GW to display: current GW if it has scores, else last GW with scores
          let displayGw = targetGwId;

          // Check if the current GW has any scores at all
          const currentGwHasScores =
            Number.isFinite(targetGwId) &&
            allScores.some((s: any) => Number(s.gameweek_id) === targetGwId);

          if (!currentGwHasScores) {
            // Fall back to the latest GW that has scores for this user
            const myGwIds = allScores
              .filter((s: any) => String(s.user_id) === userId)
              .map((s: any) => Number(s.gameweek_id))
              .filter((n) => Number.isFinite(n));
            if (myGwIds.length > 0) {
              displayGw = Math.max(...myGwIds);
            } else {
              // User has no scores at all — fall back to the latest GW anyone has scores for
              const allGwIds = allScores
                .map((s: any) => Number(s.gameweek_id))
                .filter((n) => Number.isFinite(n));
              if (allGwIds.length > 0) {
                displayGw = Math.max(...allGwIds);
              }
            }
          }

          setDisplayedGwId(Number.isFinite(displayGw) ? displayGw : null);

          // Get user's GW points for the displayed GW
          if (Number.isFinite(displayGw) && displayGw > 0) {
            const myGwRow = allScores.find(
              (s: any) =>
                String(s.user_id) === userId &&
                Number(s.gameweek_id) === displayGw
            );
            if (myGwRow) {
              gwPoints = Number((myGwRow as any).total_weekly_points ?? 0);
            }

            // Average & highest for the displayed GW across ALL managers (FPL style)
            const gwScores = allScores
              .filter((s: any) => Number(s.gameweek_id) === displayGw)
              .map((s: any) => Number((s as any).total_weekly_points ?? 0))
              .filter((n) => Number.isFinite(n));

            if (gwScores.length > 0) {
              avgPoints = Math.round(
                gwScores.reduce((a, b) => a + b, 0) / gwScores.length
              );
              highestPoints = Math.max(...gwScores);
            }
          }
        }
      } catch {
        // Ignore if table unavailable
      }

      // ── 2b. Fallback: compute GW points from roster + player_stats ──
      // If user_weekly_scores had no data for this user, try computing live
      if (gwPoints === 0) {
        try {
          // Find the last completed GW (before or equal to current)
          const gwIdToTry = Number(currentGW?.id ?? NaN);
          const gwCandidates: number[] = [];
          if (Number.isFinite(gwIdToTry) && gwIdToTry > 0) {
            for (let g = gwIdToTry; g >= 1; g--) gwCandidates.push(g);
          }

          // Fetch roster once (same squad for all GW candidates)
          const rosterRes = await fetch(
            `/api/rosters/current?user_id=${userId}`,
            { cache: "no-store" }
          );
          const rosterJson = rosterRes.ok ? await rosterRes.json() : null;
          const squadIds: string[] = rosterJson?.squadIds ?? [];
          const startingIds: string[] =
            rosterJson?.startingIds?.length > 0
              ? rosterJson.startingIds
              : squadIds;

          for (const tryGwId of gwCandidates) {
            if (squadIds.length === 0) break;

            const statsRes = await fetch(
              `/api/player-stats?gw_id=${tryGwId}`,
              { cache: "no-store" }
            );
            if (!statsRes.ok) continue;
            const statsJson = await statsRes.json();

            const pointsById = new Map<string, number>();
            for (const s of statsJson?.stats ?? []) {
              const pid = String((s as any).playerId ?? "");
              if (!pid || !squadIds.includes(pid)) continue;
              const pts = Number((s as any).points ?? 0);
              pointsById.set(
                pid,
                (pointsById.get(pid) ?? 0) + (Number.isFinite(pts) ? pts : 0)
              );
            }

            // Only count this GW if at least some players had stats
            if (pointsById.size === 0) continue;

            const multiplierByPlayer: Record<string, number> =
              rosterJson?.multiplierByPlayer ?? {};
            gwPoints = startingIds.reduce((sum, id) => {
              const playerId = String(id);
              const points = pointsById.get(playerId) ?? 0;
              const rawMult = Number(
                multiplierByPlayer[playerId] ??
                  (String(rosterJson?.captainId ?? "") === playerId ? 2 : 1)
              );
              const mult =
                Number.isFinite(rawMult) && rawMult > 0 ? rawMult : 1;
              return sum + points * mult;
            }, 0);

            setDisplayedGwId(tryGwId);
            break; // found a GW with data
          }
        } catch {
          // non-fatal
        }
      }

      // ── 3. Team name + new-user modal from fantasy_teams ──
      try {
        const { data: teamRow, error: teamErr } = await supabase
          .from("fantasy_teams")
          .select("user_id, name")
          .eq("user_id", userId)
          .maybeSingle();

        if (!teamErr && teamRow) {
          const dbName = (teamRow as any).name;
          if (typeof dbName === "string" && dbName.trim().length > 0) {
            setTeamName(dbName.trim());
            window.localStorage.setItem("tbl_team_name", dbName.trim());
          }
        }

        // No fantasy_teams row → new user, show mandatory modal
        if (teamErr || !teamRow) {
          setShowTeamNameModal(true);
        }
      } catch {
        // Ignore if the table/columns aren't available yet.
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
  }, [currentGW?.id]);

  React.useEffect(() => {
    loadStats();
    const timer = window.setInterval(loadStats, 30000);
    return () => window.clearInterval(timer);
  }, [loadStats]);

  const gwPointsValue = statsLoading ? "—" : stats.gwPoints ?? 0;
  const avgPointsValue = statsLoading ? "—" : stats.avgPoints ?? 0;
  const highestPointsValue = statsLoading ? "—" : stats.highestPoints ?? 0;

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
            "bg-gradient-to-br from-[#062C30] via-[#0D5C63] to-[#14919B]",
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
              <div className="mt-1 text-xs text-white/70">Fantasy Manager</div>
            </div>
          </button>

            <ChevronRight className="h-5 w-5 text-white/70" />
          </div>

          <div className="mx-auto my-4 h-0.5 w-14 rounded-full bg-white/20" />

          <div className="text-center text-xs font-semibold text-white/70">
            {gwLoading
              ? "Loading..."
              : `Gameweek ${displayedGwId ?? currentGW?.id ?? 0}`}
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

            <Link href="/dashboard/fantasy/points" className="flex-[1.2] text-center active:opacity-80 transition-opacity">
              <div className="text-4xl font-extrabold tabular-nums">
                {gwPointsValue}
              </div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs font-semibold">
                GW points
                <ChevronRight className="h-3.5 w-3.5 text-white/80" />
              </div>
            </Link>

            <Link href="/dashboard/fantasy/points?view=highest" className="flex-1 text-center active:opacity-80 transition-opacity">
              <div className="text-2xl font-bold text-white/80 tabular-nums">
                {highestPointsValue}
              </div>
              <div className="mt-1 text-[11px] font-semibold text-white/60">
                Highest
              </div>
            </Link>
          </div>

          <div className="mx-auto mb-3 h-0.5 w-14 rounded-full bg-white/20" />

          <div className="text-center text-xs font-semibold text-white/70">
            {gwLoading
              ? ""
              : `Gameweek ${deadlineGameweek?.id ?? 0}`}
          </div>
          <div className="mt-1 text-center text-sm font-bold">
            {gwLoading
              ? "Loading..."
              : `Deadline: ${formatDeadlineShort(deadlineGameweek?.deadline_time)}`}
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

      <div className="py-4 space-y-4">
        <MiniLeague />
        <RecentTransfers />
      </div>

      <TeamNameModal
        open={showTeamNameModal}
        onSaved={(name) => {
          setTeamName(name);
          window.localStorage.setItem("tbl_team_name", name);
          setShowTeamNameModal(false);
        }}
      />
    </div>
  );
}

export default function FantasyRoute() {
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAuthed(!!data.user);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user);
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
