"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

type Team = { name: string; short_name: string; logo_url?: string | null };
type Fixture = {
  id: string;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  status: "scheduled" | "played" | "final";
  home_team: Team | null;
  away_team: Team | null;
  gameweek: { id: number; name: string | null } | null;
};

function formatKickoff(iso: string | null) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-UG", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Kampala",
    });
  } catch {
    return iso;
  }
}

export default function SchedulePage() {
  const [fixtures, setFixtures] = React.useState<Fixture[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/fixtures", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load schedule");
        setFixtures(json.fixtures ?? []);
      } catch (e: any) {
        setError(e?.message || "Failed to load schedule");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Group by gameweek (ascending)
  const grouped = React.useMemo(() => {
    const map = new Map<number, Fixture[]>();
    for (const f of fixtures) {
      const list = map.get(f.gameweek_id) ?? [];
      list.push(f);
      map.set(f.gameweek_id, list);
    }
    return [...map.entries()].sort(([a], [b]) => a - b);
  }, [fixtures]);

  if (loading) {
    return (
      <div className="space-y-6 animate-in fade-in-50">
        <h2 className="text-2xl font-headline font-semibold">Game Schedule</h2>
        <div className="text-center py-12 text-sm text-muted-foreground">Loading schedule...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 animate-in fade-in-50">
        <h2 className="text-2xl font-headline font-semibold">Game Schedule</h2>
        <div className="text-center py-12 text-sm text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-semibold">Game Schedule</h2>
      </div>

      {grouped.map(([gwId, games]) => (
        <div key={gwId} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {games[0]?.gameweek?.name || `Gameweek ${gwId}`}
          </h3>

          {games.map((game) => {
            const isPlayed = game.status === "played" || game.status === "final";
            return (
              <Card key={game.id} className="overflow-hidden">
                <div className="p-4 space-y-3">
                  {/* Time + Status row */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatKickoff(game.kickoff_time)}</span>
                    <Badge
                      variant={isPlayed ? "secondary" : "default"}
                      className="capitalize text-[10px] px-2 py-0.5"
                    >
                      {game.status === "final" ? "Full Time" : game.status}
                    </Badge>
                  </div>

                  {/* Match card */}
                  <div className="flex items-center justify-between">
                    {/* Home team */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {game.home_team?.logo_url ? (
                        <Image
                          src={game.home_team.logo_url}
                          alt={game.home_team.name}
                          width={36}
                          height={36}
                          className="shrink-0 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                      )}
                      <span className="text-sm font-semibold truncate">
                        {game.home_team?.short_name || game.home_team?.name || "TBD"}
                      </span>
                    </div>

                    {/* Score / VS */}
                    <div className="shrink-0 mx-4 text-center min-w-[56px]">
                      {isPlayed && game.home_goals != null && game.away_goals != null ? (
                        <div className="text-lg font-bold tabular-nums">
                          {game.home_goals} - {game.away_goals}
                        </div>
                      ) : (
                        <div className="text-xs font-semibold text-muted-foreground uppercase">vs</div>
                      )}
                    </div>

                    {/* Away team */}
                    <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                      <span className="text-sm font-semibold truncate text-right">
                        {game.away_team?.short_name || game.away_team?.name || "TBD"}
                      </span>
                      {game.away_team?.logo_url ? (
                        <Image
                          src={game.away_team.logo_url}
                          alt={game.away_team.name}
                          width={36}
                          height={36}
                          className="shrink-0 object-contain mix-blend-multiply dark:invert dark:mix-blend-screen"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ))}

      {fixtures.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No matches scheduled yet.
        </div>
      )}
    </div>
  );
}
