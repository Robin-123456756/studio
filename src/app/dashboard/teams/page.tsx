// src/app/dashboard/teams/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type TeamRow = {
  team_uuid: string;
  name: string;
  short_name: string;
  team_code: string | null;
  logo_url: string | null;
};

export default function TeamsPage() {
  const [teams, setTeams] = React.useState<TeamRow[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        const [teamsRes, countsRes] = await Promise.all([
          fetch("/api/teams", { cache: "no-store" }),
          fetch("/api/teams/player-counts", { cache: "no-store" }),
        ]);

        const teamsJson = await teamsRes.json();
        const countsJson = await countsRes.json();

        if (!teamsRes.ok) throw new Error(teamsJson?.error || "Failed to load teams");
        if (!countsRes.ok) throw new Error(countsJson?.error || "Failed to load player counts");

        if (!cancelled) {
          setTeams(teamsJson.teams ?? []);
          setCounts(countsJson.counts ?? {});
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
        <Button type="button">
          <PlusCircle className="mr-2 h-4 w-4" /> Add New Club
        </Button>
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
            <Card
              key={team.team_uuid}
              className="flex flex-col transition-transform transform-gpu hover:-translate-y-1 hover:shadow-xl overflow-hidden"
            >
              <Link
                href={`/dashboard/teams/${team.team_uuid}`}
                className="block focus:outline-none"
                aria-label={`Open ${team.name} squad`}
              >
                <CardHeader className="flex-row items-center gap-4">
                  <div className="h-16 w-16 rounded-lg bg-white p-1 overflow-hidden">
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

                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Loading..." : `${playerCount} players`}
                  </p>
                </CardContent>
              </Link>

              <CardFooter className="flex justify-between items-center">
                <div className="text-sm font-mono text-muted-foreground">--</div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/teams/${team.team_uuid}`}>View Squad</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
