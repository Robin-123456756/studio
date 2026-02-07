"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";

import { recentScores } from "@/lib/data";
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

export default function ScoresPage() {
  const [standings, setStandings] = React.useState<StandingRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);

        // ✅ from GW1 up to latest played GW (your API auto-resolves if to_gw not provided)
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
  }, []);

  return (
    <div className="animate-in fade-in-50">
      <Tabs defaultValue="scores" className="w-full">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-headline font-semibold">Scores & Standings</h2>
          <TabsList>
            <TabsTrigger value="scores">Recent Scores</TabsTrigger>
            <TabsTrigger value="standings">Standings</TabsTrigger>
          </TabsList>
        </div>

        {/* ---------------- Scores ---------------- */}
        <TabsContent value="scores" className="mt-6">
          <div className="space-y-4">
            {recentScores.map((game) => (
              <Link key={game.id} href={`/match/${game.id}`} className="block">
                <Card className="transition-shadow hover:shadow-lg">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 md:gap-8 flex-1">
                      <div className="flex flex-col items-end gap-2 text-right flex-1">
                        <div className="flex items-center gap-2 justify-end">
                          <span className="hidden sm:inline font-medium">{game.team1.name}</span>
                          <Image
                            src={game.team1.logoUrl}
                            alt={game.team1.name}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-2xl sm:text-3xl font-bold font-headline">
                          {game.score1} - {game.score2}
                        </div>
                        <Badge variant="secondary" className="capitalize mt-1">
                          {game.status}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 md:gap-8 flex-1">
                        <div className="flex items-center gap-2">
                          <Image
                            src={game.team2.logoUrl}
                            alt={game.team2.name}
                            width={32}
                            height={32}
                            className="rounded-full"
                          />
                          <span className="hidden sm:inline font-medium">{game.team2.name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right text-sm text-muted-foreground w-28 hidden md:block">
                      <div>{new Date(game.date).toLocaleDateString()}</div>
                      <div>{game.venue}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </TabsContent>

        {/* ---------------- Standings ---------------- */}
        <TabsContent value="standings" className="mt-6">
          <Card className="rounded-2xl overflow-hidden">
            {error ? (
              <div className="p-4 text-sm text-red-600">⚠ {error}</div>
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
      </Tabs>
    </div>
  );
}
