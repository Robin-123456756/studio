"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TeamResult = {
  team_uuid: string;
  name: string;
  short_name: string | null;
  logo_url: string | null;
};

type PlayerResult = {
  id: string;
  name: string;
  web_name: string | null;
  position: string | null;
  avatar_url: string | null;
  teams?: { name: string; short_name: string | null; team_uuid: string } | null;
};

type MatchResult = {
  id: number;
  gameweek_id: number;
  kickoff_time: string | null;
  home_goals: number | null;
  away_goals: number | null;
  is_played: boolean | null;
  is_final: boolean | null;
  home_team: { name: string; logo_url: string | null } | null;
  away_team: { name: string; logo_url: string | null } | null;
};

function useDebouncedValue<T>(value: T, delay = 250) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export default function ExplorePage() {
  const [q, setQ] = React.useState("");
  const dq = useDebouncedValue(q, 250);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [teams, setTeams] = React.useState<TeamResult[]>([]);
  const [players, setPlayers] = React.useState<PlayerResult[]>([]);
  const [matches, setMatches] = React.useState<MatchResult[]>([]);

  React.useEffect(() => {
    (async () => {
      const query = dq.trim();
      if (query.length < 2) {
        setTeams([]);
        setPlayers([]);
        setMatches([]);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          cache: "no-store",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Search failed");

        setTeams(json.teams ?? []);
        setPlayers(json.players ?? []);
        setMatches(json.matches ?? []);
      } catch (e: any) {
        setError(e?.message ?? "Search failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [dq]);

  return (
    <div className="space-y-4">
      <div className="text-2xl font-extrabold tracking-tight">Explore</div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search matches, teams or players"
            className="w-full rounded-2xl border bg-background px-4 py-3 text-sm"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Type at least 2 characters.
          </div>
        </CardContent>
      </Card>

      {error ? <div className="text-sm text-red-600">⚠ {error}</div> : null}
      {loading ? <div className="text-sm text-muted-foreground">Searching…</div> : null}

      {/* Teams */}
      {teams.length > 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <div className="text-sm font-semibold">Teams</div>
            <div className="space-y-2">
              {teams.map((t) => (
                <Link
                  key={t.team_uuid}
                  href={`/dashboard/teams/${t.team_uuid}`}
                  className="flex items-center gap-3 rounded-2xl border p-3 hover:bg-muted/40"
                >
                  <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                    {t.logo_url ? (
                      <Image src={t.logo_url} alt={t.name} width={40} height={40} />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{t.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.short_name ?? "—"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Players */}
      {players.length > 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <div className="text-sm font-semibold">Players</div>
            <div className="space-y-2">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0">
                      {p.avatar_url ? (
                        <Image src={p.avatar_url} alt={p.name} width={40} height={40} />
                      ) : null}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {p.name ?? p.web_name ?? "—"}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {(p.position ?? "—")}
                        {p.teams?.short_name ? ` • ${p.teams.short_name}` : ""}
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/dashboard/players/${p.id}`}
                    className={cn("text-xs font-semibold text-muted-foreground hover:text-foreground")}
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Matches */}
      {matches.length > 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-4 space-y-2">
            <div className="text-sm font-semibold">Matches</div>
            <div className="space-y-2">
              {matches.map((m) => (
                <Link
                  key={m.id}
                  href={`/dashboard/matches?match=${m.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border p-3 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      {m.home_team?.name ?? "Home"} vs {m.away_team?.name ?? "Away"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      GW {m.gameweek_id} • {m.is_played ? "Played" : "Upcoming"}
                    </div>
                  </div>
                  <div className="font-mono font-extrabold tabular-nums">
                    {m.is_played ? `${m.home_goals ?? 0}-${m.away_goals ?? 0}` : "—"}
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Empty state */}
      {!loading && dq.trim().length >= 2 && teams.length === 0 && players.length === 0 && matches.length === 0 ? (
        <div className="text-sm text-muted-foreground">No results found.</div>
      ) : null}

      <div className="h-24 md:hidden" />
    </div>
  );
}
