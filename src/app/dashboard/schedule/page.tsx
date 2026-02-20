"use client";

import * as React from "react";
import { schedule } from "@/lib/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(time: string) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export default function SchedulePage() {
  // Group matches by date
  const grouped = React.useMemo(() => {
    const map = new Map<string, typeof schedule>();
    for (const game of schedule) {
      const existing = map.get(game.date) ?? [];
      existing.push(game);
      map.set(game.date, existing);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-semibold">Game Schedule</h2>
      </div>

      {grouped.map(([date, games]) => (
        <div key={date} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {formatDate(date)}
          </h3>

          {games.map((game) => (
            <Card key={game.id} className="overflow-hidden">
              <div className="p-4 space-y-3">
                {/* Time + Venue + Status row */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{formatTime(game.time)} • {game.venue}</span>
                  <Badge
                    variant={game.status === "completed" ? "secondary" : "default"}
                    className="capitalize text-[10px] px-2 py-0.5"
                  >
                    {game.status}
                  </Badge>
                </div>

                {/* Match card */}
                <div className="flex items-center justify-between">
                  {/* Home team */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Image
                      src={game.team1.logoUrl}
                      alt={game.team1.name}
                      width={36}
                      height={36}
                      className="shrink-0 object-contain"
                    />
                    <span className="text-sm font-semibold truncate">{game.team1.name}</span>
                  </div>

                  {/* Score / VS */}
                  <div className="shrink-0 mx-4 text-center min-w-[56px]">
                    {game.status === "completed" && game.score1 != null && game.score2 != null ? (
                      <div className="text-lg font-bold tabular-nums">
                        {game.score1} - {game.score2}
                      </div>
                    ) : (
                      <div className="text-xs font-semibold text-muted-foreground uppercase">vs</div>
                    )}
                  </div>

                  {/* Away team */}
                  <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                    <span className="text-sm font-semibold truncate text-right">{game.team2.name}</span>
                    <Image
                      src={game.team2.logoUrl}
                      alt={game.team2.name}
                      width={36}
                      height={36}
                      className="shrink-0 object-contain"
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ))}

      {schedule.length === 0 && (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No matches scheduled yet.
        </div>
      )}
    </div>
  );
}
