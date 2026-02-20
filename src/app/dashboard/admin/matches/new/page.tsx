"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TeamOption = { team_uuid: string; name: string; short_name: string | null };
type GwOption = { id: number; name: string | null };

export default function AdminNewMatchPage() {
  const router = useRouter();

  const [teams, setTeams] = React.useState<TeamOption[]>([]);
  const [gameweeks, setGameweeks] = React.useState<GwOption[]>([]);

  const [homeTeam, setHomeTeam] = React.useState("");
  const [awayTeam, setAwayTeam] = React.useState("");
  const [gwId, setGwId] = React.useState("");
  const [kickoff, setKickoff] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      try {
        const [teamsRes, gwRes] = await Promise.all([
          fetch("/api/teams", { cache: "no-store" }),
          fetch("/api/gameweeks/current", { cache: "no-store" }),
        ]);
        const teamsJson = await teamsRes.json();
        const gwJson = await gwRes.json();

        setTeams(teamsJson.teams ?? []);
        setGameweeks(gwJson.all ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!homeTeam || !awayTeam) {
      setError("Select both home and away teams.");
      return;
    }
    if (homeTeam === awayTeam) {
      setError("Home and away teams must be different.");
      return;
    }
    if (!gwId) {
      setError("Select a gameweek.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/matches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_team_uuid: homeTeam,
          away_team_uuid: awayTeam,
          gameweek_id: gwId,
          kickoff_time: kickoff || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to schedule match.");
        setSubmitting(false);
        return;
      }

      setSuccess("Match scheduled successfully!");
      setHomeTeam("");
      setAwayTeam("");
      setKickoff("");

      setTimeout(() => {
        router.push("/dashboard/matches");
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Unexpected error scheduling match.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Schedule Match</h1>
          <p className="text-sm text-muted-foreground">
            Add a new match to the fixtures.
          </p>
        </div>

        <Button asChild variant="outline" className="rounded-2xl">
          <Link href="/dashboard/matches">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Match details</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-sm text-muted-foreground py-4">Loading teams and gameweeks...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="homeTeam">Home Team</Label>
                  <select
                    id="homeTeam"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={homeTeam}
                    onChange={(e) => setHomeTeam(e.target.value)}
                    required
                  >
                    <option value="">Select home team...</option>
                    {teams.map((t) => (
                      <option key={t.team_uuid} value={t.team_uuid}>
                        {t.name} ({t.short_name ?? "—"})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="awayTeam">Away Team</Label>
                  <select
                    id="awayTeam"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={awayTeam}
                    onChange={(e) => setAwayTeam(e.target.value)}
                    required
                  >
                    <option value="">Select away team...</option>
                    {teams.map((t) => (
                      <option key={t.team_uuid} value={t.team_uuid}>
                        {t.name} ({t.short_name ?? "—"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="gw">Gameweek</Label>
                  <select
                    id="gw"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={gwId}
                    onChange={(e) => setGwId(e.target.value)}
                    required
                  >
                    <option value="">Select gameweek...</option>
                    {gameweeks.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name || `Matchday ${g.id}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="kickoff">Kickoff Time (optional)</Label>
                  <Input
                    id="kickoff"
                    type="datetime-local"
                    value={kickoff}
                    onChange={(e) => setKickoff(e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
              {success && <p className="text-sm text-emerald-500">{success}</p>}

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" className="rounded-2xl" disabled={submitting}>
                  {submitting ? "Saving..." : "Schedule Match"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-2xl"
                  onClick={() => router.push("/dashboard/matches")}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
