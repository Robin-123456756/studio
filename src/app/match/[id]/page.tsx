"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type MatchEvent = {
  playerName: string;
  playerId: string;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
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

export default function MatchPage() {
  const params = useParams();
  const matchId = (params?.id as string) ?? "";

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
      <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
        <div className="h-10 w-24 rounded-xl bg-muted/40 animate-pulse" />
        <div className="h-48 rounded-2xl bg-muted/40 animate-pulse" />
        <div className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
      </div>
    );
  }

  if (errorMsg || !match) {
    return (
      <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
        <Link
          href="/dashboard/matches?tab=matches"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Matches
        </Link>
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
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

  const statusLabel = match.is_final ? "FT" : match.is_played ? "Played" : "Scheduled";

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4 animate-in fade-in-50">
      <Link
        href="/dashboard/matches?tab=matches"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Matches
      </Link>

      {match.gameweek?.name && (
        <div className="text-center text-xs font-semibold text-muted-foreground">
          {match.gameweek.name}
        </div>
      )}

      {/* Score card */}
      <Card className="rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
              <div className="h-14 w-14 overflow-hidden rounded-full bg-muted">
                <img
                  src={home?.logo_url ?? "/placeholder-team.png"}
                  alt={home?.name ?? "Home"}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-sm font-semibold text-center truncate max-w-[100px]">
                {home?.name ?? "Home"}
              </div>
            </div>

            <div className="text-center shrink-0">
              <div className="text-4xl font-extrabold font-mono tabular-nums">
                {match.home_goals ?? "-"} – {match.away_goals ?? "-"}
              </div>
              <Badge
                variant="secondary"
                className={cn(
                  "mt-2",
                  match.is_final && "bg-emerald-500/15 text-emerald-600"
                )}
              >
                {statusLabel}
              </Badge>
            </div>

            <div className="flex flex-col items-center gap-2 min-w-0 flex-1">
              <div className="h-14 w-14 overflow-hidden rounded-full bg-muted">
                <img
                  src={away?.logo_url ?? "/placeholder-team.png"}
                  alt={away?.name ?? "Away"}
                  className="h-full w-full object-contain"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-sm font-semibold text-center truncate max-w-[100px]">
                {away?.name ?? "Away"}
              </div>
            </div>
          </div>

          {match.kickoff_time && (
            <div className="text-center mt-4 text-xs text-muted-foreground">
              {formatMatchDate(match.kickoff_time)} · {formatMatchTime(match.kickoff_time)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Events timeline */}
      {match.is_played && hasEvents && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-4">
            <h3 className="text-sm font-bold text-center">Match Events</h3>

            {(homeEvents.some((e) => e.goals > 0) || awayEvents.some((e) => e.goals > 0)) && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-2">
                  Goals
                </div>
                <div className="grid grid-cols-[1fr_24px_1fr] gap-x-2">
                  <div className="text-right space-y-1">
                    {homeEvents
                      .filter((e) => e.goals > 0)
                      .map((e) => (
                        <div key={e.playerId} className="text-sm">
                          <span className="font-medium">{e.playerName}</span>
                          {e.goals > 1 && (
                            <span className="text-muted-foreground ml-1">x{e.goals}</span>
                          )}
                          {e.isLady && <span className="text-pink-500 ml-1 text-xs">L</span>}
                        </div>
                      ))}
                  </div>
                  <div className="flex justify-center">
                    <div className="w-px bg-border h-full" />
                  </div>
                  <div className="space-y-1">
                    {awayEvents
                      .filter((e) => e.goals > 0)
                      .map((e) => (
                        <div key={e.playerId} className="text-sm">
                          <span className="font-medium">{e.playerName}</span>
                          {e.goals > 1 && (
                            <span className="text-muted-foreground ml-1">x{e.goals}</span>
                          )}
                          {e.isLady && <span className="text-pink-500 ml-1 text-xs">L</span>}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {(homeEvents.some((e) => e.assists > 0) || awayEvents.some((e) => e.assists > 0)) && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-2">
                  Assists
                </div>
                <div className="grid grid-cols-[1fr_24px_1fr] gap-x-2">
                  <div className="text-right space-y-1">
                    {homeEvents
                      .filter((e) => e.assists > 0)
                      .map((e) => (
                        <div key={e.playerId + "-a"} className="text-sm text-muted-foreground">
                          {e.playerName}
                          {e.assists > 1 && <span className="ml-1">x{e.assists}</span>}
                        </div>
                      ))}
                  </div>
                  <div className="flex justify-center">
                    <div className="w-px bg-border h-full" />
                  </div>
                  <div className="space-y-1">
                    {awayEvents
                      .filter((e) => e.assists > 0)
                      .map((e) => (
                        <div key={e.playerId + "-a"} className="text-sm text-muted-foreground">
                          {e.playerName}
                          {e.assists > 1 && <span className="ml-1">x{e.assists}</span>}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {(homeEvents.some((e) => e.yellowCards > 0 || e.redCards > 0) ||
              awayEvents.some((e) => e.yellowCards > 0 || e.redCards > 0)) && (
              <div>
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mb-2">
                  Cards
                </div>
                <div className="grid grid-cols-[1fr_24px_1fr] gap-x-2">
                  <div className="text-right space-y-1">
                    {homeEvents
                      .filter((e) => e.yellowCards > 0 || e.redCards > 0)
                      .map((e) => (
                        <div key={e.playerId + "-c"} className="text-sm flex items-center justify-end gap-1.5">
                          <span>{e.playerName}</span>
                          {e.yellowCards > 0 && (
                            <div className="w-2.5 h-3.5 rounded-[1px] bg-yellow-400" />
                          )}
                          {e.redCards > 0 && (
                            <div className="w-2.5 h-3.5 rounded-[1px] bg-red-500" />
                          )}
                        </div>
                      ))}
                  </div>
                  <div className="flex justify-center">
                    <div className="w-px bg-border h-full" />
                  </div>
                  <div className="space-y-1">
                    {awayEvents
                      .filter((e) => e.yellowCards > 0 || e.redCards > 0)
                      .map((e) => (
                        <div key={e.playerId + "-c"} className="text-sm flex items-center gap-1.5">
                          {e.yellowCards > 0 && (
                            <div className="w-2.5 h-3.5 rounded-[1px] bg-yellow-400" />
                          )}
                          {e.redCards > 0 && (
                            <div className="w-2.5 h-3.5 rounded-[1px] bg-red-500" />
                          )}
                          <span>{e.playerName}</span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {match.is_played && !hasEvents && (
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-sm text-muted-foreground text-center">
            No event details available for this match.
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4 pt-2">
        <Link
          href="/dashboard/matches?tab=matches"
          className="text-sm text-primary hover:underline"
        >
          Back to Matches
        </Link>
        <Link
          href="/dashboard/matches?tab=table"
          className="text-sm text-muted-foreground hover:underline"
        >
          View Table
        </Link>
      </div>
    </div>
  );
}
