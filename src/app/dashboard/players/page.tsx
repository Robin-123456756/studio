"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { normalizePosition, shortPos } from "@/lib/pitch-helpers";
import { cn } from "@/lib/utils";

type UiPlayer = {
  id: string;
  name: string;
  position: string;
  teamId: number | string;
  teamName: string;
  teamShort?: string | null;
  price: number;
  points: number;
  avatarUrl?: string | null;
  isLady?: boolean;
};

type PosFilter = "All" | "Goalkeeper" | "Defender" | "Midfielder" | "Forward";
type SortKey = "points" | "price" | "team" | "position";

const POS_TABS: { label: string; value: PosFilter }[] = [
  { label: "All", value: "All" },
  { label: "GK", value: "Goalkeeper" },
  { label: "DEF", value: "Defender" },
  { label: "MID", value: "Midfielder" },
  { label: "FWD", value: "Forward" },
];

const SORT_OPTIONS: { label: string; value: SortKey }[] = [
  { label: "Points", value: "points" },
  { label: "Price", value: "price" },
  { label: "Team", value: "team" },
  { label: "Position", value: "position" },
];

const POS_ORDER: Record<string, number> = {
  Goalkeeper: 0,
  Defender: 1,
  Midfielder: 2,
  Forward: 3,
};

const PAGE_SIZE = 30;

function formatUGX(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "UGX --";
  return `UGX ${value.toFixed(1)}m`;
}

export default function PlayersPage() {
  const [players, setPlayers] = React.useState<UiPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [posFilter, setPosFilter] = React.useState<PosFilter>("All");
  const [sortBy, setSortBy] = React.useState<SortKey>("points");
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const [res, authRes] = await Promise.all([
          fetch("/api/players", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
        ]);
        const json = await res.json();
        const authJson = await authRes.json().catch(() => ({}));

        if (!res.ok) throw new Error(json?.error || "Failed to load players");

        setPlayers((json.players ?? []) as UiPlayer[]);
        setIsAdmin(!!authJson?.user);
      } catch (e: any) {
        setError(e?.message || "Failed to load players");
        setPlayers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Reset visible count when filters change
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [search, posFilter, sortBy]);

  const filtered = React.useMemo(() => {
    let list = players.map((p) => ({ ...p, position: normalizePosition(p.position) }));

    if (posFilter !== "All") {
      list = list.filter((p) => p.position === posFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.teamName.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      switch (sortBy) {
        case "points":
          return (b.points ?? 0) - (a.points ?? 0);
        case "price":
          return (b.price ?? 0) - (a.price ?? 0);
        case "team":
          return a.teamName.localeCompare(b.teamName);
        case "position":
          return (POS_ORDER[a.position] ?? 9) - (POS_ORDER[b.position] ?? 9);
        default:
          return 0;
      }
    });

    return list;
  }, [players, search, posFilter, sortBy]);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Players</h1>
        {isAdmin && (
          <Button asChild className="rounded-2xl">
            <Link href="/dashboard/admin/players/new">Add</Link>
          </Button>
        )}
      </div>

      <input
        type="text"
        placeholder="Search by name or team..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-2xl border bg-card px-4 py-3 text-sm outline-none ring-ring focus:ring-2 placeholder:text-muted-foreground"
      />

      {/* Position filter tabs */}
      <div className="flex gap-2">
        {POS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setPosFilter(tab.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-semibold transition-colors",
              posFilter === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Sort by</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="rounded-xl border bg-card px-3 py-1.5 text-xs font-semibold outline-none ring-ring focus:ring-2"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} player{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 text-sm text-muted-foreground">Loading...</div>
          ) : error ? (
            <div className="p-4 text-sm text-red-500">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              {search || posFilter !== "All" ? "No players match your filters." : "No players yet."}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.slice(0, visibleCount).map((p) => (
                <Link
                  key={p.id}
                  href={`/dashboard/players/${p.id}`}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md bg-muted text-[10px] font-bold text-muted-foreground">
                      {shortPos(p.position)}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {p.name} {p.isLady ? <span className="text-pink-600">• Lady</span> : null}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.teamName}
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-mono tabular-nums">{formatUGX(p.price)}</div>
                    <div className="text-sm font-extrabold font-mono tabular-nums">{p.points} pts</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Load more */}
      {!loading && filtered.length > visibleCount && (
        <div className="flex flex-col items-center gap-1 pt-2">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
          >
            Load more
          </Button>
          <span className="text-xs text-muted-foreground">
            Showing {Math.min(visibleCount, filtered.length)} of {filtered.length}
          </span>
        </div>
      )}
    </div>
  );
}
