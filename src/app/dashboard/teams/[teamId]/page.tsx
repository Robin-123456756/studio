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

function normalize(position?: string | null): string {
  const pos = (position ?? "").trim().toLowerCase();
  if (pos === "gk" || pos === "goalkeeper" || pos === "keeper") return "Goalkeeper";
  if (pos === "def" || pos === "df" || pos === "defender") return "Defender";
  if (pos === "mid" || pos === "mf" || pos === "midfielder") return "Midfielder";
  if (pos === "fwd" || pos === "fw" || pos === "forward" || pos === "striker") return "Forward";
  return position ?? "Midfielder";
}

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = (params?.teamId as string) ?? ""; // this is team_uuid

  const [players, setPlayers] = React.useState<ApiPlayer[]>([]);
  const [teamName, setTeamName] = React.useState("Team");
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!teamId) return;

      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch(`/api/players?team_id=${teamId}`, { cache: "no-store" });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error || "Failed to load players");

        const list = (json.players ?? []) as ApiPlayer[];

        if (!cancelled) {
          setPlayers(list);

          // derive team info from first player if available
          if (list.length > 0) {
            setTeamName(list[0].teamName || "Team");
          } else {
            setTeamName("Team");
          }
        }

        // optional: fetch team info (name/logo) from /api/teams and find this team
        const teamRes = await fetch("/api/teams", { cache: "no-store" });
        const teamJson = await teamRes.json();
        if (teamRes.ok) {
          const t = (teamJson.teams ?? []).find((x: any) => x.team_uuid === teamId);
          if (t && !cancelled) {
            setTeamName(t.name ?? teamName);
            setLogoUrl(t.logo_url ?? null);
          }
        }
      } catch (e: any) {
        console.log("TeamDetailPage error:", e);
        if (!cancelled) {
          setPlayers([]);
          setTeamName("Team");
          setLogoUrl(null);
          setErrorMsg(e?.message ?? "Unknown error");
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

      {errorMsg ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center gap-3">
          {/* using <img> avoids next/image remote config issues while testing */}
          <div className="h-11 w-11 rounded-2xl bg-white p-1 overflow-hidden">
            <img
              src={logoUrl ?? "/placeholder.png"}
              alt={teamName}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>

          <div>
            <CardTitle className="text-lg font-semibold">{teamName}</CardTitle>
            <p className="text-xs text-muted-foreground">
              {loading ? "Loading..." : `${players.length} players`}
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-2">
        {players.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-3">
              <div className="grid grid-cols-[minmax(0,1fr)_56px_44px] items-center gap-1">
                {/* Player */}
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
                    <div className="text-sm font-semibold truncate">
                      {p.name} {p.isLady ? <span className="text-pink-600">• Lady</span> : null}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {normalize(p.position)}
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div className="text-right border-l pl-1">
                  <div className="text-[11px] text-muted-foreground leading-none">Price</div>
                  <div className="text-sm font-mono font-semibold tabular-nums">
                    ${p.price ?? 0}m
                  </div>
                </div>

                {/* Points */}
                <div className="text-right border-l pl-1">
                  <div className="text-[11px] text-muted-foreground leading-none">Pts</div>
                  <div className="text-sm font-mono font-extrabold tabular-nums">
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
