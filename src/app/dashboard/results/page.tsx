"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ApiGameweek = {
  id: number;
  name: string | null;
  deadline_time: string | null;
  finalized?: boolean | null;
  is_current?: boolean | null;
};

type ApiResult = {
  id: string;
  gameweek_id: number;
  kickoff_time: string | null;
  home_team: { name: string; short_name: string; logo_url?: string | null };
  away_team: { name: string; short_name: string; logo_url?: string | null };
  home_score: number | null;
  away_score: number | null;
  status: "FT" | "LIVE" | "NS";
};

function formatKickoffUG(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  })
    .format(d)
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

export default function ResultsPage() {
  const [gw, setGw] = React.useState<{ current: ApiGameweek | null; next: ApiGameweek | null } | null>(null);
  const [gwId, setGwId] = React.useState<number | null>(null);

  const [results, setResults] = React.useState<ApiResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // Load current/next gameweek (you already have this API)
  React.useEffect(() => {
    (async () => {
      const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
      const json = await res.json();
      setGw({ current: json.current ?? null, next: json.next ?? null });

      // show current by default (or next if current finalized)
      const defaultGw =
        json.current && json.current.finalized === false ? json.current.id : json.next?.id ?? json.current?.id ?? null;

      setGwId(defaultGw);
    })();
  }, []);

  // Load results for selected GW
  React.useEffect(() => {
    if (!gwId) return;
    (async () => {
      try {
        setLoading(true);
        setErr(null);

        const res = await fetch(`/api/results?gw_id=${gwId}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load results");

        setResults(json.results ?? []);
      } catch (e: any) {
        setErr(e?.message ?? "Unknown error");
        setResults([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [gwId]);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">Results</div>
          <div className="text-sm text-muted-foreground">
            {gwId ? `Showing GW ${gwId}` : "Loading gameweek..."}
          </div>
        </div>

        <Button asChild variant="outline" className="rounded-2xl">
          <Link href="/dashboard/more">Back</Link>
        </Button>
      </div>

      {/* GW selector */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold">Gameweek</div>

            <select
              value={gwId ?? ""}
              onChange={(e) => setGwId(Number(e.target.value))}
              className="rounded-xl border bg-background px-3 py-2 text-sm"
            >
              {/* If you later create /api/gameweeks, you can list all here.
                  For now we show current + next */}
              {gw?.current?.id ? <option value={gw.current.id}>{`GW ${gw.current.id} • ${gw.current.name ?? ""}`}</option> : null}
              {gw?.next?.id ? <option value={gw.next.id}>{`GW ${gw.next.id} • ${gw.next.name ?? ""}`}</option> : null}
            </select>
          </div>
        </CardContent>
      </Card>

      {err ? <div className="text-sm text-red-600">⚠ {err}</div> : null}

      {/* Results list */}
      <div className="space-y-3">
        {loading ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">Loading results...</CardContent></Card>
        ) : results.length === 0 ? (
          <Card><CardContent className="p-4 text-sm text-muted-foreground">No results for this gameweek yet.</CardContent></Card>
        ) : (
          results.map((m) => (
            <Card key={m.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {m.status} • {formatKickoffUG(m.kickoff_time)}
                  </div>

                  <div
                    className={cn(
                      "text-xs font-semibold rounded-full border px-2 py-0.5 whitespace-nowrap",
                      m.status === "LIVE" ? "border-emerald-400 text-emerald-700" : ""
                    )}
                  >
                    {m.status === "FT" ? "Full Time" : m.status === "LIVE" ? "Live" : "Not Started"}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-[1fr,auto,1fr] items-center gap-3">
                  {/* Home */}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{m.home_team.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.home_team.short_name}</div>
                  </div>

                  {/* Score */}
                  <div className="text-center">
                    <div className="font-mono text-lg font-extrabold tabular-nums">
                      {(m.home_score ?? "-")} : {(m.away_score ?? "-")}
                    </div>
                  </div>

                  {/* Away */}
                  <div className="min-w-0 text-right">
                    <div className="text-sm font-semibold truncate">{m.away_team.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{m.away_team.short_name}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
