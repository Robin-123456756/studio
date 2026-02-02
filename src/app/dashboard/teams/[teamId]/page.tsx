"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ApiTeam = {
  id: string;
  name: string;
  short_name?: string | null;
  logo_url?: string | null;
  wins?: number | null;
  draws?: number | null;
  losses?: number | null;
};

type ApiPlayer = {
  id: string;
  name: string;
  position: string;
  price: number | null;
  points: number | null;
  avatarUrl: string | null;
  isLady: boolean | null;
  teamId: string;
};

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = (params?.teamId as string) ?? "";

  const [team, setTeam] = React.useState<ApiTeam | null>(null);
  const [players, setPlayers] = React.useState<ApiPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!teamId) return;

      try {
        setLoading(true);

        const [teamRes, playersRes] = await Promise.all([
          fetch(`/api/teams/${teamId}`, { cache: "no-store" }),
          fetch(`/api/players?team_id=${teamId}`, { cache: "no-store" }),
        ]);

        const teamJson = await teamRes.json();
        const playersJson = await playersRes.json();

        if (!teamRes.ok) throw new Error(teamJson?.error || "Failed to load team");
        if (!playersRes.ok) throw new Error(playersJson?.error || "Failed to load players");

        if (!cancelled) {
          setTeam(teamJson.team ?? null);
          setPlayers(playersJson.players ?? []);
        }
      } catch (e) {
        console.log("TeamDetailPage error:", e);
        if (!cancelled) {
          setTeam(null);
          setPlayers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

  if (!teamId) {
    return (
      <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28">
        <p className="text-sm text-muted-foreground">Missing team id.</p>
        <Link href="/dashboard/teams" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
          <ChevronLeft className="h-4 w-4" /> Back to Teams
        </Link>
      </div>
    );
  }

  if (!loading && !team) {
    return (
      <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28">
        <p className="text-sm text-muted-foreground">Team not found.</p>
        <Link href="/dashboard/teams" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold">
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
            src={team?.logo_url ?? "/placeholder.png"}
            alt={team?.name ?? "Team"}
            width={44}
            height={44}
            className="rounded-2xl bg-white p-1"
          />
          <div className="min-w-0">
            <CardTitle className="text-xl truncate">
              {loading ? "Loading..." : (team?.name ?? "Team")}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {loading ? "Loading..." : `${players.length} players`}
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-2">
        {players.map((p) => (
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
                    <div className="text-xs text-muted-foreground truncate">{p.position}</div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Price</div>
                  <div className="font-mono font-semibold tabular-nums">
                    ${p.price ?? 0}m
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs text-muted-foreground">Pts</div>
                  <div className="font-mono font-extrabold tabular-nums">
                    {p.points ?? 0}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!loading && players.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players for this team yet.</p>
        ) : null}
      </div>
    </div>
  );
}
