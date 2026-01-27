"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DbPlayer = {
  id: string;
  name: string;
  position: string;
  team_id: string | number;
  price: number;
  points: number;
};

export default function PlayersPage() {
  const [players, setPlayers] = React.useState<DbPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const res = await fetch("/api/players", { cache: "no-store" });
      const json = await res.json();
      setPlayers(json.players ?? []);
      setLoading(false);
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
          ) : players.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">No players yet.</div>
          ) : (
            <div className="divide-y">
              {players.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.position} • teamId: {p.team_id}
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
