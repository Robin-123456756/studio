"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ApiPlayer = {
  id: string;
  name: string;
  position: string;
  price: number | null;
  points: number | null;
  avatarUrl: string | null;
  isLady: boolean | null;
  teamId: string;
  teamName: string;
  teamShort: string;
};

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = (params?.teamId as string) ?? "";

  const [players, setPlayers] = React.useState<ApiPlayer[]>([]);
  const [teamName, setTeamName] = React.useState<string>("Team");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!teamId) return;

      try {
        setLoading(true);

        const res = await fetch(`/api/players?team_id=${teamId}`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error || "Failed to load players");

        const list = (json.players ?? []) as ApiPlayer[];

        if (!cancelled) {
          setPlayers(list);

          // Derive team display info from first player (join gives teamName/teamShort)
          if (list.length > 0) {
            setTeamName(list[0].teamName || "Team");
          } else {
            setTeamName("Team");
          }
        }
      } catch (e) {
        console.log("TeamDetailPage error:", e);
        if (!cancelled) {
          setPlayers([]);
          setTeamName("Team");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [teamId]);

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
            src={logoUrl ?? "/placeholder.png"}
            alt={teamName}
            width={44}
            height={44}
            className="rounded-2xl bg-white p-1"
          />
          <div>
            <CardTitle className="text-xl">{teamName}</CardTitle>
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
                    <div className="text-xs text-muted-foreground truncate">
                      {p.position}
                    </div>
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
          <p className="text-sm text-muted-foreground">
            No players for this team yet.
          </p>
        ) : null}
      </div>
    </div>
  );
}
