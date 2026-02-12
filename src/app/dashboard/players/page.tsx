"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type UiPlayer = {
  id: string;
  name: string;          // full name
  position: string;      // Goalkeeper / Defender / Midfielder / Forward
  teamId: number | string;
  teamName: string;      // full team name
  teamShort?: string | null;
  price: number;
  points: number;
  avatarUrl?: string | null;
  isLady?: boolean;
};

function formatUGX(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "UGX --";
  return `UGX ${value.toFixed(1)}m`;
}

export default function PlayersPage() {
  const [players, setPlayers] = React.useState<UiPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");

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

  const filtered = React.useMemo(() => {
    if (!search.trim()) return players;
    const q = search.toLowerCase();
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q) ||
        p.position.toLowerCase().includes(q)
    );
  }, [players, search]);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Players</h1>
        <Button asChild className="rounded-2xl">
          <Link href="/dashboard/admin/players/new">Add</Link>
        </Button>
      </div>

      <input
        type="text"
        placeholder="Search by name, team, or position..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-2xl border bg-card px-4 py-3 text-sm outline-none ring-ring focus:ring-2 placeholder:text-muted-foreground"
      />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              {search ? "No players match your search." : "No players yet."}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/players/${p.id}`}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {p.name} {p.isLady ? <span className="text-pink-600">• Lady</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.position} - {p.teamName}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono tabular-nums">{formatUGX(p.price)}</div>
                    <div className="text-sm font-extrabold font-mono tabular-nums">{p.points}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
