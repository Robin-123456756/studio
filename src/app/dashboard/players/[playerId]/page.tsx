"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ApiPlayer = {
  id: string;
  name: string;
  webName?: string | null;
  position: string | null;
  price: number | null;
  points: number | null;
  avatarUrl: string | null;
  isLady: boolean | null;
  teamName: string | null;
  teamShort: string | null;
  teamUuid: string | null;
};

type GwStat = {
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
};

type UpcomingFixture = {
  id: string;
  kickoff_time: string | null;
  home_team: { name: string; short_name: string | null; logo_url: string | null } | null;
  away_team: { name: string; short_name: string | null; logo_url: string | null } | null;
  gameweek: { id: number; name: string | null } | null;
  home_team_uuid: string;
  away_team_uuid: string;
};

function normalize(position?: string | null): string {
  const pos = (position ?? "").trim().toLowerCase();
  if (pos === "gk" || pos === "goalkeeper" || pos === "keeper") return "Goalkeeper";
  if (pos === "def" || pos === "df" || pos === "defender") return "Defender";
  if (pos === "mid" || pos === "mf" || pos === "midfielder") return "Midfielder";
  if (pos === "fwd" || pos === "fw" || pos === "forward" || pos === "striker") return "Forward";
  return position ?? "Midfielder";
}

function shortPos(position?: string | null): string {
  const n = normalize(position);
  if (n === "Goalkeeper") return "GK";
  if (n === "Defender") return "DEF";
  if (n === "Midfielder") return "MID";
  if (n === "Forward") return "FWD";
  return "MID";
}

function formatUGX(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "UGX --";
  return `UGX ${value.toFixed(1)}m`;
}

function formatKickoff(iso: string | null) {
  if (!iso) return "TBD";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Africa/Kampala",
  }).format(new Date(iso));
}

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = (params?.playerId as string) ?? "";

  const [player, setPlayer] = React.useState<ApiPlayer | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const [stats, setStats] = React.useState<GwStat[]>([]);
  const [statsLoading, setStatsLoading] = React.useState(true);

  const [upcoming, setUpcoming] = React.useState<UpcomingFixture[]>([]);

  // Fetch player + stats in parallel
  React.useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setStatsLoading(true);
        setErrorMsg(null);

        const [playerRes, statsRes] = await Promise.all([
          fetch(`/api/players?ids=${encodeURIComponent(playerId)}`, { cache: "no-store" }),
          fetch(`/api/player-stats?player_id=${encodeURIComponent(playerId)}`, { cache: "no-store" }),
        ]);

        const playerJson = await playerRes.json();
        const statsJson = await statsRes.json();

        if (!playerRes.ok) throw new Error(playerJson?.error || "Failed to load player");

        if (!cancelled) {
          const list = (playerJson.players ?? []) as ApiPlayer[];
          if (list.length === 0) {
            setPlayer(null);
            setErrorMsg("Player not found");
          } else {
            setPlayer(list[0]);
          }
          setStats(statsJson.stats ?? []);
        }
      } catch (e: any) {
        if (!cancelled) {
          setPlayer(null);
          setErrorMsg(e?.message ?? "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setStatsLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [playerId]);

  // Fetch upcoming fixtures once we know the team
  React.useEffect(() => {
    if (!player?.teamUuid) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/fixtures?played=0&team_uuid=${player.teamUuid}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        if (!cancelled) setUpcoming((json.fixtures ?? []).slice(0, 5));
      } catch {
        // silent
      }
    })();

    return () => { cancelled = true; };
  }, [player?.teamUuid]);

  // Compute totals from stats
  const totals = React.useMemo(() => {
    return stats.reduce(
      (acc, s) => ({
        points: acc.points + s.points,
        goals: acc.goals + s.goals,
        assists: acc.assists + s.assists,
        cleanSheets: acc.cleanSheets + (s.cleanSheet ? 1 : 0),
        yellowCards: acc.yellowCards + s.yellowCards,
        redCards: acc.redCards + s.redCards,
      }),
      { points: 0, goals: 0, assists: 0, cleanSheets: 0, yellowCards: 0, redCards: 0 }
    );
  }, [stats]);

  // Aggregate stats per gameweek
  const gwStats = React.useMemo(() => {
    const map = new Map<number, GwStat>();
    for (const s of stats) {
      const existing = map.get(s.gameweekId);
      if (!existing) {
        map.set(s.gameweekId, { ...s });
      } else {
        existing.points += s.points;
        existing.goals += s.goals;
        existing.assists += s.assists;
        existing.cleanSheet = existing.cleanSheet || s.cleanSheet;
        existing.yellowCards += s.yellowCards;
        existing.redCards += s.redCards;
      }
    }
    return Array.from(map.values()).sort((a, b) => a.gameweekId - b.gameweekId);
  }, [stats]);

  // Last 5 form
  const form = React.useMemo(() => {
    return gwStats.slice(-5).map((s) => s.points);
  }, [gwStats]);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <Link
        href="/dashboard/players"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Players
      </Link>

      {errorMsg ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {/* Profile header */}
      <Card className="overflow-hidden rounded-2xl">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className="h-16 w-16 rounded-2xl bg-muted overflow-hidden shrink-0">
            <img
              src={player?.avatarUrl ?? "/placeholder-player.png"}
              alt={player?.name ?? "Player"}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg font-semibold truncate">
              {loading ? "Loading..." : player?.name ?? "Player"}
            </CardTitle>
            <p className="text-xs text-muted-foreground truncate">
              {player?.teamName ?? "Team"}{player?.teamShort ? ` · ${player.teamShort}` : ""}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold">
                {shortPos(player?.position)}
              </span>
              {player?.isLady && (
                <span className="inline-flex items-center rounded-full bg-pink-500/15 px-2 py-0.5 text-[10px] font-semibold text-pink-600">
                  Lady
                </span>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Price</div>
            <div className="text-sm font-mono font-semibold tabular-nums">
              {formatUGX(player?.price)}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Total Pts</div>
            <div className="text-sm font-mono font-extrabold tabular-nums">
              {statsLoading ? "—" : totals.points}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Form</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              {form.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                form.map((pts, i) => (
                  <span
                    key={i}
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white",
                      pts >= 6 ? "bg-emerald-500" : pts >= 3 ? "bg-amber-500" : "bg-red-500"
                    )}
                  >
                    {pts}
                  </span>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Season totals */}
      {!statsLoading && stats.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <div className="text-[10px] text-muted-foreground">Goals</div>
            <div className="text-sm font-bold tabular-nums">{totals.goals}</div>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <div className="text-[10px] text-muted-foreground">Assists</div>
            <div className="text-sm font-bold tabular-nums">{totals.assists}</div>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <div className="text-[10px] text-muted-foreground">CS</div>
            <div className="text-sm font-bold tabular-nums">{totals.cleanSheets}</div>
          </div>
          <div className="rounded-xl bg-muted/50 p-2.5 text-center">
            <div className="text-[10px] text-muted-foreground">Cards</div>
            <div className="text-sm font-bold tabular-nums">
              {totals.yellowCards > 0 && (
                <span className="text-yellow-500">{totals.yellowCards}Y</span>
              )}
              {totals.yellowCards > 0 && totals.redCards > 0 && " "}
              {totals.redCards > 0 && (
                <span className="text-red-500">{totals.redCards}R</span>
              )}
              {totals.yellowCards === 0 && totals.redCards === 0 && "0"}
            </div>
          </div>
        </div>
      )}

      {/* GW-by-GW stats table */}
      {statsLoading ? (
        <div className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
      ) : gwStats.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4 text-sm text-muted-foreground text-center">
            No gameweek stats yet.
          </CardContent>
        </Card>
      ) : (
        <Card className="rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="px-3 py-2 text-left font-semibold">GW</th>
                    <th className="px-2 py-2 text-center font-semibold">Pts</th>
                    <th className="px-2 py-2 text-center font-semibold">G</th>
                    <th className="px-2 py-2 text-center font-semibold">A</th>
                    <th className="px-2 py-2 text-center font-semibold">CS</th>
                    <th className="px-2 py-2 text-center font-semibold">YC</th>
                    <th className="px-2 py-2 text-center font-semibold">RC</th>
                  </tr>
                </thead>
                <tbody>
                  {gwStats.map((s) => (
                    <tr key={s.gameweekId} className="border-b border-border/30">
                      <td className="px-3 py-2 font-semibold">{s.gameweekId}</td>
                      <td className="px-2 py-2 text-center font-mono font-bold tabular-nums">
                        {s.points}
                      </td>
                      <td className="px-2 py-2 text-center font-mono tabular-nums">{s.goals}</td>
                      <td className="px-2 py-2 text-center font-mono tabular-nums">{s.assists}</td>
                      <td className="px-2 py-2 text-center">
                        {s.cleanSheet ? (
                          <span className="text-emerald-500 font-bold">1</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {s.yellowCards > 0 ? (
                          <span className="text-yellow-500 font-bold">{s.yellowCards}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center">
                        {s.redCards > 0 ? (
                          <span className="text-red-500 font-bold">{s.redCards}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-muted/30 font-bold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums">{totals.points}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums">{totals.goals}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums">{totals.assists}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums text-emerald-500">{totals.cleanSheets}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums text-yellow-500">{totals.yellowCards}</td>
                    <td className="px-2 py-2 text-center font-mono tabular-nums text-red-500">{totals.redCards}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upcoming fixtures */}
      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-bold">Upcoming Fixtures</h3>
          <div className="space-y-2">
            {upcoming.map((f) => {
              const isHome = f.home_team_uuid === player?.teamUuid;
              const opponent = isHome ? f.away_team : f.home_team;
              const label = isHome ? "H" : "A";

              return (
                <div
                  key={f.id}
                  className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 overflow-hidden shrink-0">
                      <img
                        src={opponent?.logo_url ?? "/placeholder-team.png"}
                        alt={opponent?.name ?? "Team"}
                        className="h-full w-full object-contain"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {opponent?.short_name ?? opponent?.name ?? "TBD"}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      ({label})
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">
                      {formatKickoff(f.kickoff_time)}
                    </div>
                    {f.gameweek?.name && (
                      <div className="text-[10px] text-muted-foreground/60">
                        {f.gameweek.name}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
