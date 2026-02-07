"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ApiPlayer = {
  id: string;
  name: string;
  webName?: string | null;
  position: string | null;
  price: number | null;
  points: number | null;
  avatarUrl: string | null;
  isLady: boolean | null;
  teamName: string | null;
  teamShort: string | null;
};

function normalize(position?: string | null): string {
  const pos = (position ?? "").trim().toLowerCase();
  if (pos === "gk" || pos === "goalkeeper" || pos === "keeper") return "Goalkeeper";
  if (pos === "def" || pos === "df" || pos === "defender") return "Defender";
  if (pos === "mid" || pos === "mf" || pos === "midfielder") return "Midfielder";
  if (pos === "fwd" || pos === "fw" || pos === "forward" || pos === "striker") return "Forward";
  return position ?? "Midfielder";
}

function formatUGX(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "UGX --";
  return `UGX ${value.toFixed(1)}m`;
}

export default function PlayerProfilePage() {
  const params = useParams();
  const playerId = (params?.playerId as string) ?? "";

  const [player, setPlayer] = React.useState<ApiPlayer | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!playerId) return;

      try {
        setLoading(true);
        setErrorMsg(null);

        const res = await fetch(`/api/players?ids=${encodeURIComponent(playerId)}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok) throw new Error(json?.error || "Failed to load player");

        const list = (json.players ?? []) as ApiPlayer[];
        if (!cancelled) {
          if (list.length === 0) {
            setPlayer(null);
            setErrorMsg("Player not found");
          } else {
            setPlayer(list[0]);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setPlayer(null);
          setErrorMsg(e?.message ?? "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [playerId]);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <Link
        href="/dashboard/explore"
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
          <div className="h-14 w-14 rounded-2xl bg-muted overflow-hidden shrink-0">
            <img
              src={player?.avatarUrl ?? "/placeholder-player.png"}
              alt={player?.name ?? "Player"}
              className="h-full w-full object-cover"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg font-semibold truncate">
              {loading ? "Loading..." : player?.name ?? player?.webName ?? "Player"}
            </CardTitle>
            <p className="text-xs text-muted-foreground truncate">
              {player?.teamName ?? "Team"}{player?.teamShort ? ` • ${player.teamShort}` : ""}
            </p>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Position</div>
            <div className="text-sm font-semibold">{normalize(player?.position)}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Lady</div>
            <div className="text-sm font-semibold">{player?.isLady ? "Yes" : "No"}</div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Price</div>
            <div className="text-sm font-mono font-semibold tabular-nums">
              {formatUGX(player?.price)}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Points</div>
            <div className="text-sm font-mono font-extrabold tabular-nums">
              {player?.points ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
