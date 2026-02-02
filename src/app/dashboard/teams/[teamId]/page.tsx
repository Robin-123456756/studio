"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type DbTeam = {
  id: string; // uuid
  name: string;
  logo_url: string | null;
};

type DbPlayer = {
  id: string;
  name: string;
  position: string;
  team_id: string | null;        // uuid
  avatar_url: string | null;     // ✅ use your real DB column name
  price: number | null;
  points: number | null;
};

export default function TeamDetailPage() {
  const params = useParams();

  // ✅ matches folder name [teamId]
  const teamId = (params?.teamId as string) ?? "";

  const [team, setTeam] = React.useState<DbTeam | null>(null);
  const [teamPlayers, setTeamPlayers] = React.useState<DbPlayer[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!teamId) return;

      try {
        setLoading(true);

        // 1) Load team details
        const { data: teamData, error: teamErr } = await supabase
          .from("teams")
          .select("id,name,logo_url")
          .eq("id", teamId)
          .single();

        if (teamErr) throw teamErr;

        // 2) Load players for this team
        const { data: playersData, error: playersErr } = await supabase
          .from("players")
          .select("id,name,position,team_id,avatar_url,price,points")
          .eq("team_id", teamId)
          .order("name");

        if (playersErr) throw playersErr;

        if (!cancelled) {
          setTeam(teamData);
          setTeamPlayers(playersData ?? []);
        }
      } catch (e) {
        console.log("TeamDetailPage error:", e);
        if (!cancelled) {
          setTeam(null);
          setTeamPlayers([]);
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
          <div>
            <CardTitle className="text-xl">{team?.name ?? "Loading..."}</CardTitle>
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
                      src={p.avatar_url ?? "/placeholder-player.png"}
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

        {!loading && teamPlayers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No players for this team yet.</p>
        ) : null}
      </div>
    </div>
  );
}
