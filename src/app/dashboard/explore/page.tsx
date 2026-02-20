"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { normalizePosition } from "@/lib/pitch-helpers";

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

type TopCard = {
  playerId: string;
  name: string;
  value: number;
  label: string;
  team: string;
  avatarUrl: string | null;
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

  // Top performer cards
  const [topScorer, setTopScorer] = React.useState<TopCard | null>(null);
  const [topAssister, setTopAssister] = React.useState<TopCard | null>(null);
  const [topCleanSheet, setTopCleanSheet] = React.useState<TopCard | null>(null);
  const [bestLady, setBestLady] = React.useState<TopCard | null>(null);
  const [cardsLoading, setCardsLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        setCardsLoading(true);
        const res = await fetch("/api/player-stats", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error);

        const stats: any[] = json.stats ?? [];

        // Aggregate goals per player
        const goalMap = new Map<string, { name: string; goals: number; team: string; avatarUrl: string | null; id: string }>();
        const assistMap = new Map<string, { name: string; assists: number; team: string; avatarUrl: string | null; id: string }>();
        const csMap = new Map<string, { name: string; cs: number; team: string; avatarUrl: string | null; id: string }>();
        const ladyMap = new Map<string, { name: string; points: number; team: string; avatarUrl: string | null; id: string }>();

        for (const s of stats) {
          const id = s.playerId;
          const name = s.playerName ?? "—";
          const team = s.player?.teamShort ?? s.player?.teamName ?? "—";
          const avatarUrl = s.player?.avatarUrl ?? null;
          const pos = normalizePosition(s.player?.position);

          if (s.goals > 0) {
            const e = goalMap.get(id);
            goalMap.set(id, { name, goals: (e?.goals ?? 0) + s.goals, team, avatarUrl, id });
          }
          if (s.assists > 0) {
            const e = assistMap.get(id);
            assistMap.set(id, { name, assists: (e?.assists ?? 0) + s.assists, team, avatarUrl, id });
          }
          if (s.cleanSheet && pos === "Goalkeeper") {
            const e = csMap.get(id);
            csMap.set(id, { name, cs: (e?.cs ?? 0) + 1, team, avatarUrl, id });
          }
          if (s.player?.isLady) {
            const e = ladyMap.get(id);
            ladyMap.set(id, { name, points: (e?.points ?? 0) + (s.points ?? 0), team, avatarUrl, id });
          }
        }

        const topG = [...goalMap.values()].sort((a, b) => b.goals - a.goals)[0];
        const topA = [...assistMap.values()].sort((a, b) => b.assists - a.assists)[0];
        const topCS = [...csMap.values()].sort((a, b) => b.cs - a.cs)[0];
        const topL = [...ladyMap.values()].sort((a, b) => b.points - a.points)[0];

        if (topG) setTopScorer({ playerId: topG.id, name: topG.name, value: topG.goals, label: topG.goals === 1 ? "goal" : "goals", team: topG.team, avatarUrl: topG.avatarUrl });
        if (topA) setTopAssister({ playerId: topA.id, name: topA.name, value: topA.assists, label: topA.assists === 1 ? "assist" : "assists", team: topA.team, avatarUrl: topA.avatarUrl });
        if (topCS) setTopCleanSheet({ playerId: topCS.id, name: topCS.name, value: topCS.cs, label: topCS.cs === 1 ? "clean sheet" : "clean sheets", team: topCS.team, avatarUrl: topCS.avatarUrl });
        if (topL) setBestLady({ playerId: topL.id, name: topL.name, value: topL.points, label: "pts", team: topL.team, avatarUrl: topL.avatarUrl });
      } catch {
        // silent — cards just won't show
      } finally {
        setCardsLoading(false);
      }
    })();
  }, []);

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

      {/* Top Performer Cards */}
      {!cardsLoading && (topScorer || topAssister || topCleanSheet || bestLady) && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { data: topScorer, title: "Top Scorer", color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { data: topAssister, title: "Top Assists", color: "text-blue-500", bg: "bg-blue-500/10" },
            { data: topCleanSheet, title: "Top Clean Sheets", color: "text-amber-500", bg: "bg-amber-500/10" },
            { data: bestLady, title: "Best Lady Player", color: "text-pink-500", bg: "bg-pink-500/10" },
          ].map(({ data: card, title, color, bg }) =>
            card ? (
              <Link
                key={title}
                href={`/dashboard/players/${card.playerId}`}
                className="block"
              >
                <Card className="rounded-2xl hover:-translate-y-0.5 hover:shadow-md transition-all">
                  <CardContent className="p-3 space-y-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                      {title}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className={cn("h-9 w-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center", bg)}>
                        {card.avatarUrl ? (
                          <img
                            src={card.avatarUrl}
                            alt={card.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className={cn("text-sm font-bold", color)}>
                            {card.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate leading-tight">
                          {card.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {card.team}
                        </div>
                      </div>
                    </div>
                    <div className={cn("text-lg font-extrabold tabular-nums font-mono", color)}>
                      {card.value} <span className="text-xs font-semibold">{card.label}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ) : null
          )}
        </div>
      )}

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
