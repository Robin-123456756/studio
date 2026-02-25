"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type DbPlayer = {
  id: string;
  name: string;

  // may be "GK/DEF/MID/FWD" or full words
  position: string | null;

  team_id: string | null;

  // add these two (from API)
  teamName?: string | null;
  teamShort?: string | null;

  avatar_url: string | null;
  price: number | null;
  points: number | null;
};

function positionFull(pos?: string | null) {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "Goalkeeper";
  if (p === "def" || p === "defender" || p === "df") return "Defender";
  if (p === "mid" || p === "midfielder" || p === "mf") return "Midfielder";
  if (p === "fwd" || p === "forward" || p === "fw" || p === "striker") return "Forward";
  // if your DB already stores "Goalkeeper" etc, this keeps it
  return pos ?? "--";
}

function formatUGX(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "UGX --";
  return `UGX ${value.toFixed(1)}m`;
}

export default function PlayersPage() {
  const [players, setPlayers] = React.useState<DbPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/players", { cache: "no-store" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Request failed with ${res.status}`);
        }
        const json = await res.json();
        setPlayers(json.players ?? []);
      } catch (err: any) {
        console.error(err);
        setError(err.message || "Failed to load players");
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
                    {/* full name */}
                    <div className="font-semibold truncate">{p.name}</div>

                    {/* full position + full team name */}
                    <div className="text-xs text-muted-foreground truncate">
                      {positionFull(p.position)} - {p.teamName ?? p.teamShort ?? `Team #${p.team_id ?? "--"}`}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono tabular-nums">{formatUGX(p.price)}</div>
                    <div className="text-sm font-extrabold font-mono tabular-nums">{Number(p.points ?? 0)}</div>
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
