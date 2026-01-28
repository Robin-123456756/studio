"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type UiPlayer = {
  id: string;
  name: string;          // ✅ full name
  position: string;      // ✅ Goalkeeper / Defender / Midfielder / Forward
  teamId: number | string;
  teamName: string;      // ✅ full team name
  teamShort?: string | null;
  price: number;
  points: number;
  avatarUrl?: string | null;
  isLady?: boolean;
};

export default function PlayersPage() {
  const [players, setPlayers] = React.useState<UiPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch("/api/players", { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error || "Failed to load players");

        setPlayers((json.players ?? []) as UiPlayer[]);
      } catch (e: any) {
        setError(e?.message || "Failed to load players");
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Players</h1>
        <Button asChild className="rounded-2xl">
          <Link href="/dashboard/admin/players/new">Add</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-500">{error}</div>
          ) : players.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No players yet.</div>
          ) : (
            <div className="divide-y">
              {players.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {p.name} {p.isLady ? "👩" : ""}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.position} • {p.teamName}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono tabular-nums">${p.price}m</div>
                    <div className="text-sm font-extrabold font-mono tabular-nums">{p.points}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
