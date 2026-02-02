"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type TeamRow = {
  id: string; // uuid
  name: string;
  logo_url: string | null;
  wins?: number;
  draws?: number;
  losses?: number;
};

type PlayerRow = {
  team_id: string | null;
};

export default function TeamsPage() {
  const [teams, setTeams] = React.useState<TeamRow[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const { data: teamsData, error: teamsErr } = await supabase
          .from("teams")
          .select("id,name,logo_url,wins,draws,losses")
          .order("name");

        if (teamsErr) throw teamsErr;

        const { data: playersData, error: playersErr } = await supabase
          .from("players")
          .select("team_id");

        if (playersErr) throw playersErr;

        const map: Record<string, number> = {};
        for (const row of (playersData as PlayerRow[]) ?? []) {
          if (!row.team_id) continue;
          map[row.team_id] = (map[row.team_id] ?? 0) + 1;
        }

        if (!cancelled) {
          setTeams(teamsData ?? []);
          setCounts(map);
        }
      } catch (e) {
        console.log("TeamsPage error:", e);
        if (!cancelled) {
          setTeams([]);
          setCounts({});
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

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {teams.map((team) => {
          const playerCount = counts[team.id] ?? 0;

          return (
            <Card
              key={team.id}
              className="flex flex-col transition-transform transform-gpu hover:-translate-y-1 hover:shadow-xl overflow-hidden"
            >
              <Link
                href={`/dashboard/teams/${team.id}`}   // ✅ uuid
                className="block focus:outline-none"
                aria-label={`Open ${team.name} squad`}
              >
                <CardHeader className="flex-row items-center gap-4">
                  <Image
                    src={team.logo_url ?? "/placeholder.png"}
                    alt={`${team.name} logo`}
                    width={64}
                    height={64}
                    className="rounded-lg bg-white p-1"
                  />
                  <div className="min-w-0">
                    <CardTitle className="text-lg font-headline truncate">
                      {team.name}
                    </CardTitle>
                  </div>
                </CardHeader>

                <CardContent className="flex-grow">
                  <p className="text-sm text-muted-foreground">
                    {loading ? "Loading..." : `${playerCount} players`}
                  </p>
                </CardContent>
              </Link>

              <CardFooter className="flex justify-between items-center">
                <div className="text-sm font-mono">
                  <span className="font-semibold text-green-400">{team.wins ?? 0}W</span>-
                  <span className="font-semibold text-gray-400">{team.draws ?? 0}D</span>-
                  <span className="font-semibold text-red-400">{team.losses ?? 0}L</span>
                </div>

                <Button asChild variant="outline" size="sm">
                  <Link href={`/dashboard/teams/${team.id}`}>View Squad</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
