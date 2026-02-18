"use client";

import * as React from "react";
import Image from "next/image";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// ---------- Types ----------
type StandingRow = {
  teamId: string;
  name: string;
  logoUrl: string;
  PL: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  LP: number;
  Pts: number;
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
  home_team: {
    team_uuid: string;
    name: string;
    short_name: string | null;
    logo_url: string | null;
  } | null;
  away_team: {
    team_uuid: string;
    name: string;
    short_name: string | null;
    logo_url: string | null;
  } | null;
};

type LeaderboardEntry = {
  rank: number;
  userId: string;
  teamName: string;
  totalPoints: number;
  gwBreakdown: Record<number, number>;
};

// ---------- Helpers ----------
function formatMatchDate(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Kampala",
  }).format(d);
}

// ---------- Page ----------
export default function ScoresPage() {
  // Standings state
  const [standings, setStandings] = React.useState<StandingRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Live fixtures state
  const [fixtures, setFixtures] = React.useState<ApiFixture[]>([]);
  const [fixturesLoading, setFixturesLoading] = React.useState(true);
  const [fixturesError, setFixturesError] = React.useState<string | null>(null);

  // Fantasy leaderboard state
  const [leaderboard, setLeaderboard] = React.useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = React.useState(true);
  const [lbError, setLbError] = React.useState<string | null>(null);

  // Fetch all data in parallel
  React.useEffect(() => {
    // Standings
    (async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/standings?from_gw=1", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load standings");
        setStandings((json.rows ?? []) as StandingRow[]);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load standings");
        setStandings([]);
      } finally {
        setLoading(false);
      }
    })();

    // Played fixtures (recent scores)
    (async () => {
      try {
        setFixturesLoading(true);
        const res = await fetch("/api/fixtures?played=1", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load scores");
        const sorted = (json.fixtures ?? []).sort((a: ApiFixture, b: ApiFixture) => {
          const ta = a.kickoff_time ? new Date(a.kickoff_time).getTime() : 0;
          const tb = b.kickoff_time ? new Date(b.kickoff_time).getTime() : 0;
          return tb - ta;
        });
        setFixtures(sorted);
      } catch (e: any) {
        setFixturesError(e?.message ?? "Failed to load scores");
      } finally {
        setFixturesLoading(false);
      }
    })();

    // Fantasy leaderboard
    (async () => {
      try {
        setLbLoading(true);
        const res = await fetch("/api/fantasy-leaderboard", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load leaderboard");
        setLeaderboard(json.leaderboard ?? []);
      } catch (e: any) {
        setLbError(e?.message ?? "Failed to load leaderboard");
      } finally {
        setLbLoading(false);
      }
    })();
  }, []);

  // Group fixtures by gameweek (newest first)
  const fixturesByGw = React.useMemo(() => {
    const map = new Map<number, ApiFixture[]>();
    for (const f of fixtures) {
      const key = f.gameweek_id;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .map(([gwId, matches]) => ({ gwId, matches }));
  }, [fixtures]);

  return (
    <div className="animate-in fade-in-50">
      <Tabs defaultValue="scores" className="w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-headline font-semibold">Scores & Standings</h2>
          <TabsList>
            <TabsTrigger value="scores">Results</TabsTrigger>
            <TabsTrigger value="standings">Table</TabsTrigger>
            <TabsTrigger value="fantasy">Fantasy</TabsTrigger>
          </TabsList>
        </div>

        {/* ---------------- Recent Results ---------------- */}
        <TabsContent value="scores" className="mt-6">
          {fixturesError ? (
            <div className="text-sm text-red-600 py-4">{fixturesError}</div>
          ) : fixturesLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Loading recent results...</div>
          ) : fixtures.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">No match results yet.</div>
          ) : (
            <div className="space-y-6">
              {fixturesByGw.map(({ gwId, matches }) => (
                <div key={gwId} className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Gameweek {gwId}
                  </h3>
                  {matches.map((fixture) => (
                    <Card key={fixture.id} className="overflow-hidden transition-shadow hover:shadow-lg">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          {/* Home */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            {fixture.home_team?.logo_url ? (
                              <Image
                                src={fixture.home_team.logo_url}
                                alt={fixture.home_team.name}
                                width={32}
                                height={32}
                                className="rounded-full shrink-0 object-contain"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                            )}
                            <span className="font-medium truncate text-sm">
                              {fixture.home_team?.short_name ?? fixture.home_team?.name ?? "TBD"}
                            </span>
                          </div>

                          {/* Score */}
                          <div className="shrink-0 mx-4 text-center min-w-[64px]">
                            <div className="text-2xl font-bold font-headline tabular-nums">
                              {fixture.home_goals ?? 0} - {fixture.away_goals ?? 0}
                            </div>
                            <Badge variant="secondary" className="capitalize text-[10px] mt-1">
                              {fixture.is_final ? "FT" : "Played"}
                            </Badge>
                          </div>

                          {/* Away */}
                          <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                            <span className="font-medium truncate text-sm text-right">
                              {fixture.away_team?.short_name ?? fixture.away_team?.name ?? "TBD"}
                            </span>
                            {fixture.away_team?.logo_url ? (
                              <Image
                                src={fixture.away_team.logo_url}
                                alt={fixture.away_team.name}
                                width={32}
                                height={32}
                                className="rounded-full shrink-0 object-contain"
                              />
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                            )}
                          </div>
                        </div>

                        {/* Date */}
                        {fixture.kickoff_time && (
                          <div className="mt-2 text-center text-xs text-muted-foreground">
                            {formatMatchDate(fixture.kickoff_time)}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ---------------- Standings ---------------- */}
        <TabsContent value="standings" className="mt-6">
          <Card className="rounded-2xl overflow-hidden">
            {error ? (
              <div className="p-4 text-sm text-red-600">{error}</div>
            ) : loading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading standings...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-center">W</TableHead>
                    <TableHead className="text-center">D</TableHead>
                    <TableHead className="text-center">L</TableHead>
                    <TableHead className="text-right">Pts</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {standings.map((team, index) => (
                    <TableRow key={team.teamId}>
                      <TableCell className="font-medium tabular-nums">{index + 1}</TableCell>

                      <TableCell>
                        <div className="flex items-center gap-3 min-w-0">
                          <Image
                            src={team.logoUrl || "/placeholder-team.png"}
                            alt={team.name}
                            width={24}
                            height={24}
                            className="rounded-full shrink-0"
                          />
                          <span className="font-medium truncate">{team.name}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center font-mono tabular-nums">{team.W}</TableCell>
                      <TableCell className="text-center font-mono tabular-nums">{team.D}</TableCell>
                      <TableCell className="text-center font-mono tabular-nums">{team.L}</TableCell>

                      <TableCell className="text-right font-bold font-mono tabular-nums">
                        {team.Pts}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* ---------------- Fantasy Leaderboard ---------------- */}
        <TabsContent value="fantasy" className="mt-6">
          <Card className="rounded-2xl overflow-hidden">
            {lbError ? (
              <div className="p-4 text-sm text-red-600">{lbError}</div>
            ) : lbLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Loading fantasy leaderboard...</div>
            ) : leaderboard.length === 0 ? (
              <div className="p-8 text-sm text-muted-foreground text-center">
                No fantasy teams found. Users need to create teams and scores need to be calculated.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="text-right">Points</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {leaderboard.map((entry) => {
                    const gwKeys = Object.keys(entry.gwBreakdown)
                      .map(Number)
                      .sort((a, b) => a - b);

                    return (
                      <TableRow key={entry.userId}>
                        <TableCell className="font-medium tabular-nums">{entry.rank}</TableCell>

                        <TableCell>
                          <div className="min-w-0">
                            <span className="font-medium truncate block">{entry.teamName}</span>
                            {gwKeys.length > 0 && (
                              <span className="text-[11px] text-muted-foreground">
                                {gwKeys.map(gw => `GW${gw}: ${entry.gwBreakdown[gw]}`).join(" · ")}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-bold font-mono tabular-nums">
                          {entry.totalPoints}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
