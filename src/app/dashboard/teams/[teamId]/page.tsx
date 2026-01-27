"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teams, type Team } from "@/lib/data";

// ✅ Make team_id a number (matches Supabase int4)
type DbPlayer = {
  id: string;
  name: string;
  position: string;
  team_id: number;
  avatarUrl: string | null;
  price: number;
  points: number;
};

// ✅ teamId here is the ROUTE slug (string), not db id
function getTeam(teamSlug: string): Team | undefined {
  return teams.find((t) => t.id === teamSlug);
}

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = (params?.teamId as string) ?? "";

  const team = React.useMemo(() => getTeam(teamId), [teamId]);

  const [teamPlayers, setTeamPlayers] = React.useState<DbPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!team) return;

      try {
        setLoading(true);

        // team.dbId should be the numeric teams.id from Supabase
        const res = await fetch(`/api/players?team_id=${team.dbId}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error || "Failed to load players");

        if (!cancelled) setTeamPlayers((json.players ?? []) as DbPlayer[]);
      } catch {
        if (!cancelled) setTeamPlayers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [team]);

  if (!team) {
    return (
      <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28">
        <p className="text-sm text-muted-foreground">Team not found.</p>
        <Link
          href="/dashboard/teams"
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Teams
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <Link
        href="/dashboard/teams"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </Link>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-3">
          <Image
            src={team.logoUrl}
            alt={team.name}
            width={44}
            height={44}
            className="rounded-2xl"
          />
          <div>
            <CardTitle className="text-xl">{team.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading..." : `${teamPlayers.length} players`}
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-2">
        {teamPlayers.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 rounded-full overflow-hidden bg-muted shrink-0">
                    <img
                      src={p.avatarUrl ?? "/placeholder-player.png"}
                      alt={p.name}
                      className="h-11 w-11 object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {p.position}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="font-mono font-semibold tabular-nums">
                    ${p.price}m
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Pts</div>
                  <div className="font-mono font-extrabold tabular-nums">
                    {p.points}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!loading && teamPlayers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No players for this team yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
