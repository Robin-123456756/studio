// src/app/dashboard/teams/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { teams } from "@/lib/data";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TeamWithDbId = (typeof teams)[number] & { dbId?: number };

export default function TeamsPage() {
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loadingCounts, setLoadingCounts] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        setLoadingCounts(true);
        const res = await fetch("/api/teams/player-counts", { cache: "no-store" });
        const json = await res.json();
        setCounts(json.counts ?? {});
      } catch (e) {
        // If API fails, keep counts empty (fallback will show 0)
        setCounts({});
      } finally {
        setLoadingCounts(false);
      }
    })();
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
        {(teams as TeamWithDbId[]).map((team) => {
          const dbKey = team.dbId != null ? String(team.dbId) : "";
          const playerCount =
            dbKey && counts[dbKey] != null ? counts[dbKey] : 0;

          return (
            <Card
              key={team.id}
              className="flex flex-col transition-transform transform-gpu hover:-translate-y-1 hover:shadow-xl overflow-hidden"
            >
              {/* ✅ Make the whole top area clickable */}
              <Link
                href={`/dashboard/teams/${team.id}`}
                className="block focus:outline-none"
                aria-label={`Open ${team.name} squad`}
              >
                <CardHeader className="flex-row items-center gap-4">
                  <Image
                    src={team.logoUrl}
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
                    {loadingCounts ? "Loading..." : `${playerCount} players`}
                  </p>
                </CardContent>
              </Link>

              <CardFooter className="flex justify-between items-center">
                <div className="text-sm font-mono">
                  <span className="font-semibold text-green-400">{team.wins}W</span>-
                  <span className="font-semibold text-gray-400">{team.draws}D</span>-
                  <span className="font-semibold text-red-400">{team.losses}L</span>
                </div>

                {/* ✅ Button also links */}
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
