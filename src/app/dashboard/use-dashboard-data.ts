"use client";

import * as React from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  ApiMatch,
  DashboardTopLady,
  DashboardTopPerformer,
  FantasyQuickStats,
  FeedMediaItem,
  GWInfo,
  Row,
  TransferActivityItem,
} from "./dashboard-types";

export function useDashboardData() {
  const [table, setTable] = React.useState<Row[]>([]);
  const [recentMatches, setRecentMatches] = React.useState<ApiMatch[]>([]);
  const [transfers, setTransfers] = React.useState<TransferActivityItem[]>([]);
  const [feedMedia, setFeedMedia] = React.useState<FeedMediaItem[]>([]);
  const [topPerformer, setTopPerformer] = React.useState<DashboardTopPerformer>(null);
  const [upcomingMatches, setUpcomingMatches] = React.useState<ApiMatch[]>([]);
  const [topLady, setTopLady] = React.useState<DashboardTopLady>(null);
  const [loading, setLoading] = React.useState(true);
  const [resultIdx, setResultIdx] = React.useState(0);
  const [fixtureIdx, setFixtureIdx] = React.useState(0);
  const [currentGW, setCurrentGW] = React.useState<GWInfo | null>(null);
  const [nextGW, setNextGW] = React.useState<GWInfo | null>(null);
  const [fantasyStats, setFantasyStats] = React.useState<FantasyQuickStats>(null);
  const [fantasyLoading, setFantasyLoading] = React.useState(true);
  const [isLoggedIn, setIsLoggedIn] = React.useState<boolean | null>(null);
  const firstLoad = React.useRef(true);
  const prevScores = React.useRef<Map<string, string>>(new Map());
  const scoreChangeTimer = React.useRef<number | null>(null);
  const [changedIds, setChangedIds] = React.useState<Set<string>>(new Set());
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
  const [ago, setAgo] = React.useState("");

  const loadDashboard = React.useCallback(async () => {
    try {
      if (firstLoad.current) setLoading(true);

      const [teamsRes, standingsRes, gwRes, playersRes] = await Promise.all([
        fetch("/api/teams", { cache: "no-store" }),
        fetch("/api/standings", { cache: "no-store" }),
        fetch("/api/gameweeks/current", { cache: "no-store" }),
        fetch("/api/players?dynamic_points=1", { cache: "no-store" }),
      ]);

      const standingsJson = await standingsRes.json();
      const gwJson = await gwRes.json();
      const playersJson = await playersRes.json();

      await teamsRes.json();

      setTable((standingsJson.rows ?? []) as Row[]);

      const allPlayers = playersJson.players ?? [];
      const ladies = allPlayers.filter((player: any) => player.isLady && (player.points ?? 0) > 0);
      if (ladies.length > 0) {
        const best = ladies.sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0))[0];
        setTopLady({
          name: best.name,
          points: best.points ?? 0,
          teamName: best.teamName ?? "--",
          avatarUrl: best.avatarUrl ?? null,
          position: best.position ?? null,
          goals: best.totalGoals ?? 0,
          assists: best.totalAssists ?? 0,
          playerId: best.id,
        });
      } else {
        setTopLady(null);
      }

      const currentGwId = gwJson.current?.id;
      const nextGwId = gwJson.next?.id;
      const allGws: number[] = (gwJson.all ?? []).map((gameweek: any) => gameweek.id);

      setCurrentGW(gwJson.current ?? null);
      setNextGW(gwJson.next ?? null);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const userId = sessionData.session?.user.id;
        setIsLoggedIn(!!userId);

        if (userId) {
          const lbRes = await fetch("/api/fantasy-leaderboard", {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (lbRes.ok) {
            const lbJson = await lbRes.json();
            const entries = lbJson.leaderboard ?? [];
            const me = entries.find((entry: any) => entry.userId === userId);
            if (me) {
              let myGwPts = me.gwBreakdown?.[currentGwId] ?? 0;
              if (myGwPts === 0 && me.gwBreakdown) {
                const gwIds = Object.keys(me.gwBreakdown)
                  .map(Number)
                  .filter((id) => Number.isFinite(id) && id > 0)
                  .sort((a, b) => b - a);
                for (const gid of gwIds) {
                  if (me.gwBreakdown[gid] > 0) {
                    myGwPts = me.gwBreakdown[gid];
                    break;
                  }
                }
              }

              let myTotalPts = me.totalPoints ?? 0;

              if (myTotalPts === 0 || myGwPts === 0) {
                try {
                  const rosterRes = await fetch(`/api/rosters/current?user_id=${userId}`, {
                    cache: "no-store",
                  });
                  if (rosterRes.ok) {
                    const rosterJson = await rosterRes.json();
                    const squadIds: string[] = rosterJson?.squadIds ?? [];
                    const startingIds: string[] =
                      rosterJson?.startingIds?.length > 0 ? rosterJson.startingIds : squadIds;

                    if (squadIds.length > 0) {
                      const startGw = currentGwId ?? nextGwId ?? 1;
                      for (let gw = startGw; gw >= 1 && myGwPts === 0; gw--) {
                        const statsRes = await fetch(`/api/player-stats?gw_id=${gw}`, {
                          cache: "no-store",
                        });
                        if (!statsRes.ok) continue;
                        const statsJson = await statsRes.json();

                        const ptsById = new Map<string, number>();
                        for (const stat of statsJson?.stats ?? []) {
                          const playerId = String((stat as any).playerId ?? "");
                          if (!playerId || !squadIds.includes(playerId)) continue;
                          const points = Number((stat as any).points ?? 0);
                          ptsById.set(
                            playerId,
                            (ptsById.get(playerId) ?? 0) + (Number.isFinite(points) ? points : 0)
                          );
                        }
                        if (ptsById.size === 0) continue;

                        const multipliers: Record<string, number> =
                          rosterJson?.multiplierByPlayer ?? {};
                        myGwPts = startingIds.reduce((sum, id) => {
                          const playerId = String(id);
                          const points = ptsById.get(playerId) ?? 0;
                          const rawMultiplier = Number(
                            multipliers[playerId] ??
                              (String(rosterJson?.captainId ?? "") === playerId ? 2 : 1)
                          );
                          const multiplier =
                            Number.isFinite(rawMultiplier) && rawMultiplier > 0 ? rawMultiplier : 1;
                          return sum + points * multiplier;
                        }, 0);
                      }

                      if (myTotalPts === 0 && myGwPts > 0) {
                        myTotalPts = myGwPts;
                      }
                    }
                  }
                } catch {
                  // Best-effort fallback only.
                }
              }

              setFantasyStats({
                rank: me.rank,
                totalPoints: myTotalPts,
                gwPoints: myGwPts,
                teamName: me.teamName ?? "My Team",
              });
            } else {
              setFantasyStats(null);
            }
          }
        } else {
          setFantasyStats(null);
        }
      } catch {
        // Fantasy stats are optional.
      } finally {
        setFantasyLoading(false);
      }

      const gwsToFetchPlayed = allGws.filter((id: number) => id <= (currentGwId ?? 0));
      const recentFetches = gwsToFetchPlayed.map((gwId: number) =>
        fetch(`/api/matches?gw_id=${gwId}&played=1&enrich=1`, { cache: "no-store" })
          .then((response) => response.json())
          .then((json) => json.matches ?? [])
          .catch(() => [])
      );

      const upcomingGwIds = [...new Set([currentGwId, nextGwId].filter(Boolean))] as number[];
      const upcomingFetches = upcomingGwIds.map((gwId) =>
        fetch(`/api/matches?gw_id=${gwId}&played=0`, { cache: "no-store" })
          .then((response) => response.json())
          .then((json) => json.matches ?? [])
          .catch(() => [])
      );

      const transferFetch = fetch("/api/transfers/activity?limit=5", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : { transfers: [] }))
        .catch(() => ({ transfers: [] }));
      const topPerfFetch = currentGwId
        ? fetch(`/api/player-stats?gw_id=${currentGwId}`, { cache: "no-store" })
            .then((response) => (response.ok ? response.json() : { stats: [] }))
            .catch(() => ({ stats: [] }))
        : Promise.resolve({ stats: [] });
      const mediaFetch = fetch("/api/feed-media", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : { items: [] }))
        .catch(() => ({ items: [] }));

      const [recentArrays, txData, perfData, mediaData, ...upcomingArrays] = await Promise.all([
        Promise.all(recentFetches),
        transferFetch,
        topPerfFetch,
        mediaFetch,
        ...upcomingFetches,
      ]);

      const upcoming = upcomingArrays.flat();
      const allPlayed: ApiMatch[] = recentArrays.flat();
      const maxPlayedGw = allPlayed.reduce((max, match) => Math.max(max, match.gameweek_id ?? 0), 0);
      const newRecent = allPlayed.filter((match) => match.gameweek_id === maxPlayedGw);

      let perfStats: any[] = perfData.stats ?? [];
      if (perfStats.length === 0 && maxPlayedGw > 0 && maxPlayedGw !== currentGwId) {
        try {
          const fallbackRes = await fetch(`/api/player-stats?gw_id=${maxPlayedGw}`, {
            cache: "no-store",
          });
          if (fallbackRes.ok) {
            const fallbackJson = await fallbackRes.json();
            perfStats = fallbackJson.stats ?? [];
          }
        } catch {
          // Best-effort fallback only.
        }
      }

      if (!firstLoad.current) {
        const changed = new Set<string>();
        for (const match of newRecent) {
          const score = `${match.home_goals ?? "-"}-${match.away_goals ?? "-"}`;
          const prev = prevScores.current.get(match.id);
          if (prev !== undefined && prev !== score) {
            changed.add(match.id);
          }
        }
        if (changed.size > 0) {
          setChangedIds(changed);
          if (scoreChangeTimer.current !== null) {
            window.clearTimeout(scoreChangeTimer.current);
          }
          scoreChangeTimer.current = window.setTimeout(() => {
            setChangedIds(new Set());
            scoreChangeTimer.current = null;
          }, 3000);
        }
      }

      const nextScores = new Map<string, string>();
      for (const match of newRecent) {
        nextScores.set(match.id, `${match.home_goals ?? "-"}-${match.away_goals ?? "-"}`);
      }
      prevScores.current = nextScores;

      setRecentMatches(newRecent);
      setUpcomingMatches(upcoming);
      setTransfers(txData.transfers ?? []);
      setFeedMedia(mediaData.items ?? []);

      const sortedPerf = perfStats.sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0));
      if (sortedPerf.length > 0) {
        const best = sortedPerf[0];
        setTopPerformer({
          name: best.playerName ?? best.player?.name ?? best.name ?? "--",
          points: best.points ?? 0,
          teamName:
            best.player?.teamShort ?? best.player?.teamName ?? best.teamShortName ?? best.teamName ?? "--",
          goals: best.goals ?? 0,
          assists: best.assists ?? 0,
          isLady: best.player?.isLady ?? best.isLady ?? false,
          playerId: best.playerId ?? "",
        });
      } else {
        setTopPerformer(null);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      if (firstLoad.current) {
        setLoading(false);
        firstLoad.current = false;
      }
    }
  }, []);

  React.useEffect(() => {
    loadDashboard();
    const timer = window.setInterval(loadDashboard, 30_000);
    return () => window.clearInterval(timer);
  }, [loadDashboard]);

  React.useEffect(() => {
    if (!lastUpdated) return;
    const tick = () => {
      const seconds = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
      setAgo(seconds < 5 ? "just now" : `${seconds}s ago`);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [lastUpdated]);

  React.useEffect(() => {
    if (recentMatches.length <= 1) return;
    const timer = window.setInterval(() => {
      setResultIdx((index) => (index + 1) % recentMatches.length);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [recentMatches.length]);

  React.useEffect(() => {
    if (upcomingMatches.length <= 1) return;
    const timer = window.setInterval(() => {
      setFixtureIdx((index) => (index + 1) % upcomingMatches.length);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [upcomingMatches.length]);

  React.useEffect(() => {
    return () => {
      if (scoreChangeTimer.current !== null) {
        window.clearTimeout(scoreChangeTimer.current);
      }
    };
  }, []);

  return {
    table,
    recentMatches,
    transfers,
    feedMedia,
    topPerformer,
    upcomingMatches,
    topLady,
    loading,
    resultIdx,
    fixtureIdx,
    currentGW,
    nextGW,
    fantasyStats,
    fantasyLoading,
    isLoggedIn,
    changedIds,
    lastUpdated,
    ago,
  };
}
