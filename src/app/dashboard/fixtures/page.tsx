"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type ApiTeam = {
  team_uuid: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};

type ApiGameweek = {
  id: number;
  name: string | null;
  deadline_time?: string | null;
  finalized?: boolean | null;
};

type ApiFixture = {
  id: string;
  home_team_uuid: string;
  away_team_uuid: string;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean;
  is_final: boolean;
  status: "scheduled" | "played" | "final";
  venue: string;
  match_day_label: string | null;
  home_team: ApiTeam | null;
  away_team: ApiTeam | null;
  gameweek: { id: number; name: string | null } | null;
};

// ---------- Helpers ----------
function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Kampala",
  });
}

function formatTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  })
    .format(d)
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

function dateKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function groupByDate(fixtures: ApiFixture[]) {
  const map = new Map<string, ApiFixture[]>();
  for (const f of fixtures) {
    const key = f.kickoff_time ? dateKey(f.kickoff_time) : "TBD";
    const arr = map.get(key) ?? [];
    arr.push(f);
    map.set(key, arr);
  }
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
}

function statusBadgeVariant(status: string): "default" | "destructive" | "secondary" {
  if (status === "final") return "secondary";
  if (status === "played") return "default";
  return "default";
}

function statusLabel(status: string) {
  if (status === "final") return "FT";
  if (status === "played") return "Played";
  return "Scheduled";
}

// ---------- Page ----------
export default function FixturesPage() {
  const [allGws, setAllGws] = React.useState<ApiGameweek[]>([]);
  const [gwId, setGwId] = React.useState<number | null>(null);
  const [fixtures, setFixtures] = React.useState<ApiFixture[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // All gameweek IDs (for navigation — include future gameweeks too)
  const gwIds = React.useMemo(
    () => allGws.map((g) => g.id).sort((a, b) => a - b),
    [allGws]
  );

  const activeGw = allGws.find((g) => g.id === gwId);
  const activeName = activeGw?.name ?? (gwId ? `Gameweek ${gwId}` : "—");

  const canPrev = gwId != null && gwIds.indexOf(gwId) > 0;
  const canNext = gwId != null && gwIds.indexOf(gwId) < gwIds.length - 1;

  // Load gameweeks
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load gameweeks");

        const all: ApiGameweek[] = json.all ?? [];
        setAllGws(all);

        // Default to current or next gameweek
        const defaultId =
          json.current?.id ?? json.next?.id ?? (all.length > 0 ? all[0].id : null);
        setGwId(defaultId);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load gameweeks");
        setLoading(false);
      }
    })();
  }, []);

  // Fetch fixtures when gwId changes
  React.useEffect(() => {
    if (gwId == null) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/fixtures?gw_id=${gwId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load fixtures");

        setFixtures(json.fixtures ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load fixtures");
        setFixtures([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [gwId]);

  const grouped = React.useMemo(() => groupByDate(fixtures), [fixtures]);

  return (
    <div className="space-y-5 animate-in fade-in-50">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/fantasy"
          className="grid h-9 w-9 place-items-center rounded-full border bg-background hover:bg-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h2 className="text-xl font-headline font-semibold">Fixtures</h2>
      </div>

      {/* Gameweek selector */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            const idx = gwIds.indexOf(gwId ?? -1);
            if (idx > 0) setGwId(gwIds[idx - 1]);
          }}
          disabled={!canPrev}
          className={cn(
            "grid h-11 w-11 place-items-center rounded-full border bg-background",
            !canPrev && "opacity-40"
          )}
          aria-label="Previous gameweek"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center min-w-0">
          <div className="text-lg font-extrabold truncate">{activeName}</div>
        </div>

        <button
          type="button"
          onClick={() => {
            const idx = gwIds.indexOf(gwId ?? -1);
            if (idx >= 0 && idx < gwIds.length - 1) setGwId(gwIds[idx + 1]);
          }}
          disabled={!canNext}
          className={cn(
            "grid h-11 w-11 place-items-center rounded-full border bg-background",
            !canNext && "opacity-40"
          )}
          aria-label="Next gameweek"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Error */}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {/* Content */}
      {loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading fixtures...
        </div>
      ) : fixtures.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          No fixtures scheduled for this gameweek.
        </div>
      ) : (
        grouped.map(([date, games]) => (
          <div key={date} className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {date === "TBD" ? "Date TBD" : formatDate(games[0].kickoff_time!)}
            </h3>

            {games.map((fixture) => {
              const hasScore = fixture.is_played || fixture.is_final;
              return (
                <Card key={fixture.id} className="overflow-hidden">
                  <div className="p-4 space-y-3">
                    {/* Time + Status */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {fixture.kickoff_time ? formatTime(fixture.kickoff_time) : "TBD"}
                        {fixture.venue ? ` • ${fixture.venue}` : ""}
                      </span>
                      <Badge
                        variant={statusBadgeVariant(fixture.status)}
                        className="capitalize text-[10px] px-2 py-0.5"
                      >
                        {statusLabel(fixture.status)}
                      </Badge>
                    </div>

                    {/* Teams + Score */}
                    <div className="flex items-center justify-between">
                      {/* Home */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {fixture.home_team?.logo_url ? (
                          <Image
                            src={fixture.home_team.logo_url}
                            alt={fixture.home_team.name}
                            width={36}
                            height={36}
                            className="shrink-0 object-contain"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
                        )}
                        <span className="text-sm font-semibold truncate">
                          {fixture.home_team?.short_name ?? fixture.home_team?.name ?? "TBD"}
                        </span>
                      </div>

                      {/* Score or VS */}
                      <div className="shrink-0 mx-4 text-center min-w-[56px]">
                        {hasScore ? (
                          <div className="text-lg font-extrabold tabular-nums">
                            {fixture.home_goals ?? 0} - {fixture.away_goals ?? 0}
                          </div>
                        ) : (
                          <div className="text-xs font-semibold text-muted-foreground uppercase">
                            vs
                          </div>
                        )}
                      </div>

                      {/* Away */}
                      <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                        <span className="text-sm font-semibold truncate text-right">
                          {fixture.away_team?.short_name ?? fixture.away_team?.name ?? "TBD"}
                        </span>
                        {fixture.away_team?.logo_url ? (
                          <Image
                            src={fixture.away_team.logo_url}
                            alt={fixture.away_team.name}
                            width={36}
                            height={36}
                            className="shrink-0 object-contain"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
