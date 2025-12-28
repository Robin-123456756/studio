// src/app/dashboard/teams/[teamId]/page.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { teams, type Team, type Player } from "@/lib/data";
function getTeam(teamId: string): Team | undefined {
  return teams.find((t) => String(t.id) === String(teamId));
}

function getPlayersForTeam(team: Team): Player[] {
  // ✅ If your data already stores players inside each team
  if (Array.isArray((team as any).players)) {
    return (team as any).players as Player[];
  }

  // ✅ Otherwise, build a global list from teams
  const allPlayers = teams.flatMap((t: any) => (Array.isArray(t.players) ? t.players : []));

  // Prefer teamId match if present
  const byId = allPlayers.filter((p: any) => String(p.teamId) === String(team.id));
  if (byId.length > 0) return byId;

  // Fallback: team name match (only if p.team exists)
  return allPlayers.filter((p: any) => String(p.team) === String(team.name));
}

export default function TeamDetailPage() {
  const params = useParams();
  const teamId = (params?.teamId as string) ?? "";

  const team = getTeam(teamId);

  if (!team) {
    return (
      <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28">
        <p className="text-sm text-muted-foreground">Team not found.</p>

        <Link
          href="/dashboard/teams"
          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-foreground"
        >
          <ChevronLeft className="h-4 w-4" /> Back to Teams
        </Link>
      </div>
    );
  }

  const teamPlayers = getPlayersForTeam(team);

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
            className="rounded-2xl bg-white p-1"
          />
          <div className="min-w-0">
            <CardTitle className="text-xl truncate">{team.name}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {teamPlayers.length} players
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
                    {/* use img to avoid Next/Image domain issues */}
                    <img
                      src={p.avatarUrl}
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

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Price</div>
                    <div className="font-mono font-semibold tabular-nums">
                      ${p.price}m
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Pts</div>
                    <div className="font-mono font-extrabold tabular-nums">
                      {p.points}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {teamPlayers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No players linked to this team yet. Add{" "}
            <span className="font-semibold">teamId</span> on each player in your{" "}
            <span className="font-semibold">data</span>.
          </p>
        )}
      </div>
    </div>
  );
}



