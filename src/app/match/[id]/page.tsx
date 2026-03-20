"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

type MatchTeam = {
  team_uuid: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};

type MatchDetail = {
  id: string;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean;
  is_final: boolean;
  home_team: MatchTeam | null;
  away_team: MatchTeam | null;
  gameweek: { id: number; name: string | null } | null;
  home_events: MatchEvent[];
  away_events: MatchEvent[];
};

function formatMatchDate(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Kampala",
  }).format(new Date(iso));
}

function formatMatchTime(iso: string | null) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  })
    .format(new Date(iso))
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

/* ------------- Event section component ------------- */

function EventSection({
  title,
  icon,
  homeItems,
  awayItems,
}: {
  title: string;
  icon: React.ReactNode;
  homeItems: React.ReactNode[];
  awayItems: React.ReactNode[];
}) {
  if (homeItems.length === 0 && awayItems.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-center gap-1.5 mb-2.5">
        {icon}
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
          {title}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_24px_1fr] gap-x-2">
        <div className="text-right space-y-1.5">{homeItems}</div>
        <div className="flex justify-center">
          <div className="w-px bg-border/60 self-stretch" />
        </div>
        <div className="space-y-1.5">{awayItems}</div>
      </div>
    </div>
  );
}

export default function MatchPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = (params?.id as string) ?? "";
  const gwParam = searchParams.get("gw");
  const backHref = gwParam
    ? `/dashboard/matches?tab=matches&gw=${gwParam}`
    : "/dashboard/matches?tab=matches";
  const tableHref = gwParam
    ? `/dashboard/matches?tab=table&gw=${gwParam}`
    : "/dashboard/matches?tab=table";

  const [match, setMatch] = React.useState<MatchDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!matchId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch(`/api/matches/${encodeURIComponent(matchId)}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error || "Failed to load match");

        if (!cancelled) {
          setMatch(json.match ?? null);
        }
      } catch (e: any) {
        if (!cancelled) {
          setMatch(null);
          setErrorMsg(e?.message ?? "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [matchId]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4 animate-pulse">
        <div className="h-8 w-20 rounded-lg bg-muted/40" />
        <div className="h-5 w-24 rounded bg-muted/40 mx-auto" />
        <div className="h-52 rounded-2xl bg-muted/40" />
        <div className="h-40 rounded-2xl bg-muted/40" />
      </div>
    );
  }

  if (errorMsg || !match) {
    return (
      <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Matches
        </Link>
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/20 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-400">
          {errorMsg ?? "Match not found"}
        </div>
      </div>
    );
  }

  const home = match.home_team;
  const away = match.away_team;
  const homeEvents = match.home_events ?? [];
  const awayEvents = match.away_events ?? [];
  const hasEvents = homeEvents.length > 0 || awayEvents.length > 0;

  const isLive = match.is_played && !match.is_final;
  const homeWin = match.is_played && (match.home_goals ?? 0) > (match.away_goals ?? 0);
  const awayWin = match.is_played && (match.away_goals ?? 0) > (match.home_goals ?? 0);

  // Derive event lists
  const allEvents = [...homeEvents, ...awayEvents];
  const homeGoalScorers = homeEvents.filter((e) => e.goals > 0);
  const awayGoalScorers = awayEvents.filter((e) => e.goals > 0);
  const homeAssists = homeEvents.filter((e) => e.assists > 0);
  const awayAssists = awayEvents.filter((e) => e.assists > 0);
  const homeCards = homeEvents.filter((e) => e.yellowCards > 0 || e.redCards > 0);
  const awayCards = awayEvents.filter((e) => e.yellowCards > 0 || e.redCards > 0);
  const homeOwnGoals = homeEvents.filter((e) => e.ownGoals > 0);
  const awayOwnGoals = awayEvents.filter((e) => e.ownGoals > 0);

  // Match highlights: top scorer, top assist, clean sheet keeper
  const topScorer = allEvents
    .filter((e) => e.goals > 0)
    .sort((a, b) => b.goals - a.goals)[0] ?? null;
  const topAssist = allEvents
    .filter((e) => e.assists > 0)
    .sort((a, b) => b.assists - a.assists)[0] ?? null;
  // Clean sheet: GK from team that conceded 0
  const homeCleanSheet = match.is_played && (match.away_goals ?? 0) === 0;
  const awayCleanSheet = match.is_played && (match.home_goals ?? 0) === 0;

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4 animate-in fade-in-50">
      {/* Back link */}
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Matches
      </Link>

      {/* Gameweek label */}
      {match.gameweek?.name && (
        <div className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {match.gameweek.name}
        </div>
      )}

      {/* ===== Score Card ===== */}
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-0">
          {/* Score header */}
          <div className={cn(
            "px-6 py-6",
            isLive && "bg-red-500/[0.03]"
          )}>
            <div className="flex items-center justify-between gap-3">
              {/* Home team */}
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <img
                  src={home?.logo_url ?? "/placeholder-team.png"}
                  alt={home?.name ?? "Home"}
                  className="h-16 w-16 object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className={cn(
                  "text-sm text-center truncate max-w-[100px]",
                  homeWin ? "font-bold" : "font-semibold"
                )}>
                  {home?.name ?? "Home"}
                </div>
              </div>

              {/* Score */}
              <div className="text-center shrink-0">
                {match.is_played ? (
                  <div className={cn(
                    "font-mono text-4xl font-extrabold tabular-nums",
                    isLive && "text-red-600 dark:text-red-500"
                  )}>
                    {match.home_goals ?? "-"} – {match.away_goals ?? "-"}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl font-bold text-muted-foreground/50">vs</span>
                    {match.kickoff_time && (
                      <span className="inline-block rounded-md bg-primary/10 px-3 py-1 text-sm font-bold tabular-nums text-primary">
                        {formatMatchTime(match.kickoff_time)}
                      </span>
                    )}
                  </div>
                )}
                <div className="mt-2">
                  {match.is_final ? (
                    <span className="inline-block rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                      Full Time
                    </span>
                  ) : isLive ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                      </span>
                      Live
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-muted px-3 py-0.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Upcoming
                    </span>
                  )}
                </div>
              </div>

              {/* Away team */}
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <img
                  src={away?.logo_url ?? "/placeholder-team.png"}
                  alt={away?.name ?? "Away"}
                  className="h-16 w-16 object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
                <div className={cn(
                  "text-sm text-center truncate max-w-[100px]",
                  awayWin ? "font-bold" : "font-semibold"
                )}>
                  {away?.name ?? "Away"}
                </div>
              </div>
            </div>

            {/* Kickoff info */}
            {match.kickoff_time && (
              <div className="text-center mt-4 text-[11px] text-muted-foreground">
                {formatMatchDate(match.kickoff_time)} · {formatMatchTime(match.kickoff_time)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ===== Match Events ===== */}
      {match.is_played && hasEvents && (
        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-5">
            <h3 className="text-sm font-bold text-center">Match Events</h3>

            {/* Goals */}
            <EventSection
              title="Goals"
              icon={<span className="text-sm">⚽</span>}
              homeItems={homeGoalScorers.map((e) => (
                <div key={e.playerId} className="text-sm">
                  <span className="font-medium">{e.playerName}</span>
                  {e.goals > 1 && <span className="text-muted-foreground ml-1">x{e.goals}</span>}
                  {e.penalties > 0 && <span className="text-muted-foreground ml-1 text-xs">(P)</span>}
                  {e.isLady && <span className="text-pink-500 ml-1 text-xs font-semibold">L</span>}
                </div>
              ))}
              awayItems={awayGoalScorers.map((e) => (
                <div key={e.playerId} className="text-sm">
                  <span className="font-medium">{e.playerName}</span>
                  {e.goals > 1 && <span className="text-muted-foreground ml-1">x{e.goals}</span>}
                  {e.penalties > 0 && <span className="text-muted-foreground ml-1 text-xs">(P)</span>}
                  {e.isLady && <span className="text-pink-500 ml-1 text-xs font-semibold">L</span>}
                </div>
              ))}
            />

            {/* Assists */}
            <EventSection
              title="Assists"
              icon={<span className="text-sm">👟</span>}
              homeItems={homeAssists.map((e) => (
                <div key={e.playerId + "-a"} className="text-sm text-muted-foreground">
                  {e.playerName}
                  {e.assists > 1 && <span className="ml-1">x{e.assists}</span>}
                  {e.isLady && <span className="text-pink-500 ml-1 text-xs font-semibold">L</span>}
                </div>
              ))}
              awayItems={awayAssists.map((e) => (
                <div key={e.playerId + "-a"} className="text-sm text-muted-foreground">
                  {e.playerName}
                  {e.assists > 1 && <span className="ml-1">x{e.assists}</span>}
                  {e.isLady && <span className="text-pink-500 ml-1 text-xs font-semibold">L</span>}
                </div>
              ))}
            />

            {/* Cards */}
            <EventSection
              title="Cards"
              icon={
                <div className="flex gap-0.5">
                  <div className="w-2.5 h-3.5 rounded-[1px] bg-yellow-400" />
                  <div className="w-2.5 h-3.5 rounded-[1px] bg-red-500" />
                </div>
              }
              homeItems={homeCards.map((e) => (
                <div key={e.playerId + "-c"} className="text-sm flex items-center justify-end gap-1.5">
                  <span>{e.playerName}</span>
                  {e.yellowCards > 0 && <div className="w-3 h-4 rounded-[1px] bg-yellow-400 shrink-0" />}
                  {e.redCards > 0 && <div className="w-3 h-4 rounded-[1px] bg-red-500 shrink-0" />}
                </div>
              ))}
              awayItems={awayCards.map((e) => (
                <div key={e.playerId + "-c"} className="text-sm flex items-center gap-1.5">
                  {e.yellowCards > 0 && <div className="w-3 h-4 rounded-[1px] bg-yellow-400 shrink-0" />}
                  {e.redCards > 0 && <div className="w-3 h-4 rounded-[1px] bg-red-500 shrink-0" />}
                  <span>{e.playerName}</span>
                </div>
              ))}
            />

            {/* Own Goals */}
            <EventSection
              title="Own Goals"
              icon={<span className="text-sm">🔴</span>}
              homeItems={homeOwnGoals.map((e) => (
                <div key={e.playerId + "-og"} className="text-sm text-red-600 dark:text-red-400">
                  {e.playerName}
                  {e.ownGoals > 1 && <span className="ml-1">x{e.ownGoals}</span>}
                </div>
              ))}
              awayItems={awayOwnGoals.map((e) => (
                <div key={e.playerId + "-og"} className="text-sm text-red-600 dark:text-red-400">
                  {e.playerName}
                  {e.ownGoals > 1 && <span className="ml-1">x{e.ownGoals}</span>}
                </div>
              ))}
            />
          </CardContent>
        </Card>
      )}

      {match.is_played && !hasEvents && (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-center space-y-2">
            <div className="text-2xl">📋</div>
            <div className="text-sm text-muted-foreground">
              No event details available for this match yet.
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== Match Highlight Cards ===== */}
      {match.is_played && (topScorer || topAssist || homeCleanSheet || awayCleanSheet) && (
        <div>
          <h3 className="text-sm font-bold mb-3">Match Highlights</h3>
          <div className="grid grid-cols-1 gap-3">
            {/* Top Scorer */}
            {topScorer && (
              <div className="relative rounded-2xl border bg-card overflow-hidden min-h-[100px]">
                {/* Player photo background — add bg image via style prop or img tag */}
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-transparent" />
                <div className="relative p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-semibold mb-1">
                      Top Scorer
                    </div>
                    <div className="text-base font-bold">{topScorer.playerName}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {topScorer.goals} {topScorer.goals === 1 ? "goal" : "goals"}
                      {topScorer.penalties > 0 && ` (${topScorer.penalties}P)`}
                    </div>
                    {topScorer.isLady && (
                      <span className="inline-block mt-1 text-[10px] font-semibold text-pink-500 bg-pink-500/10 rounded-full px-2 py-0.5">
                        Lady Player
                      </span>
                    )}
                  </div>
                  <div className="text-4xl font-extrabold text-emerald-500/20 font-mono tabular-nums">
                    ⚽
                  </div>
                </div>
              </div>
            )}

            {/* Top Assist */}
            {topAssist && (
              <div className="relative rounded-2xl border bg-card overflow-hidden min-h-[100px]">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 to-transparent" />
                <div className="relative p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-violet-600 dark:text-violet-400 font-semibold mb-1">
                      Top Assists
                    </div>
                    <div className="text-base font-bold">{topAssist.playerName}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {topAssist.assists} {topAssist.assists === 1 ? "assist" : "assists"}
                    </div>
                    {topAssist.isLady && (
                      <span className="inline-block mt-1 text-[10px] font-semibold text-pink-500 bg-pink-500/10 rounded-full px-2 py-0.5">
                        Lady Player
                      </span>
                    )}
                  </div>
                  <div className="text-4xl font-extrabold text-violet-500/20 font-mono tabular-nums">
                    👟
                  </div>
                </div>
              </div>
            )}

            {/* Clean Sheet */}
            {(homeCleanSheet || awayCleanSheet) && (
              <div className="relative rounded-2xl border bg-card overflow-hidden min-h-[100px]">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent" />
                <div className="relative p-4 flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-blue-600 dark:text-blue-400 font-semibold mb-1">
                      Clean Sheet
                    </div>
                    <div className="text-base font-bold">
                      {homeCleanSheet ? (home?.name ?? "Home") : (away?.name ?? "Away")}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      0 goals conceded
                    </div>
                  </div>
                  <div className="text-4xl font-extrabold text-blue-500/20 font-mono tabular-nums">
                    🧤
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom links */}
      <div className="flex gap-4 pt-2">
        <Link
          href={backHref}
          className="text-sm text-primary font-medium hover:underline"
        >
          Back to Matches
        </Link>
        <Link
          href={tableHref}
          className="text-sm text-muted-foreground font-medium hover:underline"
        >
          View Table
        </Link>
      </div>
    </div>
  );
}
