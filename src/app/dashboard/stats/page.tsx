"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Types ─── */
type StatPlayer = {
  id: string;
  name: string;
  avatarUrl: string | null;
  position: string;
  isLady: boolean;
  teamName: string;
  teamShort: string;
  statValue: number;
};

type CategoryKey = "goals" | "assists" | "cleanSheets" | "points" | "appearances";

type CategoryDef = {
  key: CategoryKey;
  label: string;
  singular: string;
  icon: string;
  gradient: string;
  heroBg: string;
  accentText: string;
  badgeColor: string;
};

const CATEGORIES: CategoryDef[] = [
  {
    key: "goals",
    label: "Goals",
    singular: "goal",
    icon: "⚽",
    gradient: "from-amber-500 via-yellow-400 to-amber-600",
    heroBg: "bg-gradient-to-br from-amber-500 via-yellow-400 to-amber-600",
    accentText: "text-amber-900",
    badgeColor: "bg-amber-100 text-amber-800",
  },
  {
    key: "assists",
    label: "Assists",
    singular: "assist",
    icon: "🅰️",
    gradient: "from-purple-600 via-violet-500 to-purple-700",
    heroBg: "bg-gradient-to-br from-purple-600 via-violet-500 to-purple-700",
    accentText: "text-white",
    badgeColor: "bg-purple-100 text-purple-800",
  },
  {
    key: "cleanSheets",
    label: "Clean Sheets",
    singular: "clean sheet",
    icon: "🧤",
    gradient: "from-emerald-500 via-green-400 to-emerald-600",
    heroBg: "bg-gradient-to-br from-emerald-500 via-green-400 to-emerald-600",
    accentText: "text-emerald-900",
    badgeColor: "bg-emerald-100 text-emerald-800",
  },
  {
    key: "points",
    label: "Points",
    singular: "pt",
    icon: "🏆",
    gradient: "from-[#37003C] via-[#5B1065] to-[#37003C]",
    heroBg: "bg-gradient-to-br from-[#37003C] via-[#5B1065] to-[#37003C]",
    accentText: "text-white",
    badgeColor: "bg-purple-100 text-purple-900",
  },
  {
    key: "appearances",
    label: "Appearances",
    singular: "app",
    icon: "👕",
    gradient: "from-sky-500 via-blue-400 to-sky-600",
    heroBg: "bg-gradient-to-br from-sky-500 via-blue-400 to-sky-600",
    accentText: "text-sky-900",
    badgeColor: "bg-sky-100 text-sky-800",
  },
];

/* ─── Hero Card (Top Player) ─── */
function HeroCard({
  player,
  category,
}: {
  player: StatPlayer;
  category: CategoryDef;
}) {
  return (
    <Link href={`/dashboard/players/${player.id}`}>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl shadow-xl",
          category.heroBg
        )}
      >
        {/* Decorative background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/30" />
          <div className="absolute -left-4 -bottom-4 h-32 w-32 rounded-full bg-white/20" />
          <div className="absolute right-1/4 top-1/3 h-20 w-20 rounded-full bg-white/20" />
        </div>

        <div className="relative flex items-stretch p-5 gap-4">
          {/* Player Photo */}
          <div className="relative shrink-0">
            <div className="h-28 w-28 overflow-hidden rounded-xl border-2 border-white/40 shadow-lg bg-white/10">
              {player.avatarUrl ? (
                <img
                  src={player.avatarUrl}
                  alt={player.name}
                  className="h-full w-full object-cover"
                  loading="eager"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-4xl opacity-60">
                  👤
                </div>
              )}
            </div>
            {/* Crown / #1 badge */}
            <div className="absolute -top-2 -left-2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md text-sm font-extrabold text-amber-600">
              👑
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col justify-between min-w-0 flex-1 py-1">
            <div>
              <p className={cn("text-xs font-semibold uppercase tracking-wider opacity-80", category.accentText)}>
                {category.icon} {category.label} Leader
              </p>
              <h3 className={cn("text-xl font-extrabold leading-tight truncate mt-1", category.accentText)}>
                {player.name}
              </h3>
              <p className={cn("text-sm opacity-80 mt-0.5", category.accentText)}>
                {player.teamName} · {player.position}
                {player.isLady && <span className="ml-1 text-pink-200">★ Lady</span>}
              </p>
            </div>

            {/* Big stat number */}
            <div className="mt-2 flex items-end gap-2">
              <span className={cn("text-4xl font-black tabular-nums leading-none", category.accentText)}>
                {player.statValue}
              </span>
              <span className={cn("text-sm font-semibold opacity-70 pb-0.5", category.accentText)}>
                {player.statValue === 1 ? category.singular : category.label.toLowerCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

/* ─── Runner-Up Row ─── */
function RunnerUpRow({
  player,
  rank,
  category,
}: {
  player: StatPlayer;
  rank: number;
  category: CategoryDef;
}) {
  const isTopThree = rank <= 3;
  const medalEmoji = rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;

  return (
    <Link
      href={`/dashboard/players/${player.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors"
    >
      {/* Rank */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          isTopThree
            ? "bg-gradient-to-br from-amber-100 to-amber-200 text-amber-800"
            : "bg-muted text-muted-foreground"
        )}
      >
        {medalEmoji ?? rank}
      </div>

      {/* Avatar */}
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
        {player.avatarUrl ? (
          <img
            src={player.avatarUrl}
            alt={player.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg opacity-40">
            👤
          </div>
        )}
      </div>

      {/* Name & Team */}
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm truncate">
          {player.name}
          {player.isLady && <span className="ml-1 text-pink-500 text-xs">★</span>}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {player.teamName} · {player.position}
        </div>
      </div>

      {/* Stat badge */}
      <div
        className={cn(
          "shrink-0 rounded-full px-3 py-1 text-sm font-extrabold tabular-nums",
          category.badgeColor
        )}
      >
        {player.statValue}
      </div>
    </Link>
  );
}

/* ─── Loading Skeleton ─── */
function HeroSkeleton() {
  return (
    <div className="rounded-2xl bg-muted/50 p-5 flex gap-4 animate-pulse">
      <Skeleton className="h-28 w-28 rounded-xl" />
      <div className="flex-1 space-y-3 py-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-10 w-16 mt-2" />
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="divide-y">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-7 w-10 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ─── Main Page ─── */
export default function StatsPage() {
  const [data, setData] = React.useState<Record<CategoryKey, StatPlayer[]> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState<CategoryKey>("goals");

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/stats/leaders?limit=10", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load stats");
        setData({
          goals: json.goals ?? [],
          assists: json.assists ?? [],
          cleanSheets: json.cleanSheets ?? [],
          points: json.points ?? [],
          appearances: json.appearances ?? [],
        });
      } catch (e: any) {
        setError(e?.message || "Failed to load stats");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeCat = CATEGORIES.find((c) => c.key === activeTab)!;
  const players = data?.[activeTab] ?? [];
  const hero = players[0] ?? null;
  const runners = players.slice(1);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight">Player Stats</h1>
      </div>

      {/* Category Tabs — scrollable on mobile */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={cn(
              "shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap",
              activeTab === cat.key
                ? cn("text-white shadow-md", `bg-gradient-to-r ${cat.gradient}`)
                : "bg-muted text-muted-foreground hover:bg-accent"
            )}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-4">
          <HeroSkeleton />
          <Card><ListSkeleton /></Card>
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-destructive/10 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : players.length === 0 ? (
        <div className="rounded-2xl bg-muted/50 p-8 text-center text-sm text-muted-foreground">
          No {activeCat.label.toLowerCase()} recorded yet this season.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Hero Card */}
          {hero && <HeroCard player={hero} category={activeCat} />}

          {/* Runners-up List */}
          {runners.length > 0 && (
            <Card className="overflow-hidden">
              <div className="divide-y">
                {runners.map((p, i) => (
                  <RunnerUpRow
                    key={p.id}
                    player={p}
                    rank={i + 2}
                    category={activeCat}
                  />
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
