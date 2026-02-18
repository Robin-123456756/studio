// src/app/dashboard/teams/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type TeamRow = {
  team_uuid: string;
  name: string;
  short_name: string;
  team_code: string | null;
  logo_url: string | null;
};

type StandingRow = {
  teamId: string;
  W: number;
  D: number;
  L: number;
  Pts: number;
};

type LastResult = {
  homeShort: string;
  awayShort: string;
  homeGoals: number;
  awayGoals: number;
  outcome: "W" | "D" | "L";
};

export default function TeamsPage() {
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [teams, setTeams] = React.useState<TeamRow[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [standings, setStandings] = React.useState<Map<string, StandingRow & { pos: number }>>(new Map());
  const [lastResults, setLastResults] = React.useState<Map<string, LastResult>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [teamsRes, countsRes, standingsRes, fixturesRes, authRes] = await Promise.all([
          fetch("/api/teams", { cache: "no-store" }),
          fetch("/api/teams/player-counts", { cache: "no-store" }),
          fetch("/api/standings", { cache: "no-store" }),
          fetch("/api/fixtures?played=1", { cache: "no-store" }),
          fetch("/api/auth/session", { cache: "no-store" }),
        ]);

        const teamsJson = await teamsRes.json();
        const countsJson = await countsRes.json();
        const standingsJson = await standingsRes.json();
        const fixturesJson = await fixturesRes.json();

        const authJson = await authRes.json().catch(() => ({}));

        if (!teamsRes.ok) throw new Error(teamsJson?.error || "Failed to load teams");
        if (!countsRes.ok) throw new Error(countsJson?.error || "Failed to load player counts");

        if (!cancelled) {
          setIsAdmin(!!authJson?.user);
          setTeams(teamsJson.teams ?? []);
          setCounts(countsJson.counts ?? {});

          const sMap = new Map<string, StandingRow & { pos: number }>();
          const rows = standingsJson.rows ?? [];
          for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            sMap.set(r.teamId, { ...r, pos: i + 1 });
          }
          setStandings(sMap);

          // Build last result per team from played fixtures (sorted by kickoff asc, so last = most recent)
          const lrMap = new Map<string, LastResult>();
          const fixtures = fixturesJson.fixtures ?? [];
          for (const f of fixtures) {
            const hg = f.home_goals ?? 0;
            const ag = f.away_goals ?? 0;
            const hShort = f.home_team?.short_name ?? "???";
            const aShort = f.away_team?.short_name ?? "???";
            if (f.home_team_uuid) {
              lrMap.set(f.home_team_uuid, {
                homeShort: hShort, awayShort: aShort,
                homeGoals: hg, awayGoals: ag,
                outcome: hg > ag ? "W" : hg < ag ? "L" : "D",
              });
            }
            if (f.away_team_uuid) {
              lrMap.set(f.away_team_uuid, {
                homeShort: hShort, awayShort: aShort,
                homeGoals: hg, awayGoals: ag,
                outcome: ag > hg ? "W" : ag < hg ? "L" : "D",
              });
            }
          }
          setLastResults(lrMap);
        }
      } catch (e: any) {
        console.log("TeamsPage error:", e);
        if (!cancelled) {
          setTeams([]);
          setCounts({});
          setErrorMsg(e?.message ?? "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-headline font-semibold">Clubs</h2>
        {isAdmin && (
          <Button type="button">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Club
          </Button>
        )}
      </div>

      {errorMsg ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      {!loading && teams.length === 0 && !errorMsg ? (
        <div className="text-sm text-muted-foreground">No teams found in the database.</div>
      ) : null}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {teams.map((team) => {
          const playerCount = counts[team.team_uuid] ?? 0;

          return (
            <Link
              key={team.team_uuid}
              href={`/dashboard/teams/${team.team_uuid}`}
              className="block focus:outline-none"
              aria-label={`Open ${team.name} squad`}
            >
              <Card className="flex flex-col overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:border-primary/30 cursor-pointer">
                <CardHeader className="flex-row items-center gap-4">
                  <div className="h-16 w-16 rounded-lg bg-card p-1 overflow-hidden">
                    <img
                      src={team.logo_url ?? "/placeholder.png"}
                      alt={`${team.name} logo`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="min-w-0">
                    <CardTitle className="text-lg font-headline truncate">{team.name}</CardTitle>
                    <div className="text-xs text-muted-foreground">{team.short_name}</div>
                  </div>
                </CardHeader>

                <CardContent className="flex-grow space-y-1.5">
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Loading..." : `${playerCount} players`}
                  </p>
                  {(() => {
                    const s = standings.get(team.team_uuid);
                    if (!s) return null;
                    const ord = s.pos === 1 ? "st" : s.pos === 2 ? "nd" : s.pos === 3 ? "rd" : "th";
                    return (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{s.pos}{ord}</span>
                        <span>{s.W}W {s.D}D {s.L}L</span>
                      </div>
                    );
                  })()}
                  {(() => {
                    const lr = lastResults.get(team.team_uuid);
                    if (!lr) return null;
                    const color = lr.outcome === "W" ? "bg-emerald-500" : lr.outcome === "L" ? "bg-red-500" : "bg-amber-500";
                    return (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold text-white ${color}`}>
                          {lr.outcome}
                        </span>
                        <span>{lr.homeShort} {lr.homeGoals}-{lr.awayGoals} {lr.awayShort}</span>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
