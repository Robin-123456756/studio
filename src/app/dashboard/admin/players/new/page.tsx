"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { teams } from "@/lib/data";

const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const;

export default function AdminNewPlayerPage() {
  const router = useRouter();

  const [adminPass, setAdminPass] = React.useState("");
  const [name, setName] = React.useState("");
  const [position, setPosition] = React.useState<(typeof POSITIONS)[number]>("Midfielder");
  const [teamId, setTeamId] = React.useState(teams[0]?.id ?? "");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [price, setPrice] = React.useState("5.0");
  const [points, setPoints] = React.useState("0");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const saved = window.localStorage.getItem("tbl_admin_pass");
    if (saved) setAdminPass(saved);
  }, []);

  function savePass(v: string) {
    setAdminPass(v);
    window.localStorage.setItem("tbl_admin_pass", v);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-password": adminPass,
        },
        body: JSON.stringify({
          name,
          position,
          team_id: teamId,
          avatar_url: avatarUrl || null,
          price: Number(price),
          points: Number(points),
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create player");

      router.push("/dashboard/admin/players");
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <h1 className="text-2xl font-extrabold tracking-tight">Add Player</h1>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div>
            <label className="text-sm font-semibold">Admin Password</label>
            <input
              value={adminPass}
              onChange={(e) => savePass(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              placeholder="Enter admin password"
              type="password"
            />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="text-sm font-semibold">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                placeholder="Player name"
              />
            </div>

            <div>
              <label className="text-sm font-semibold">Position</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as any)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              >
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold">Team</label>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-muted-foreground">
                This must match the team route: /dashboard/teams/{`{teamId}`}
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold">Avatar URL (optional)</label>
              <input
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-semibold">Price</label>
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className="text-sm font-semibold">Points</label>
                <input
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-background px-3 py-2 text-sm"
                  inputMode="numeric"
                />
              </div>
            </div>

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <Button disabled={loading} className="w-full rounded-2xl" type="submit">
              {loading ? "Saving..." : "Save Player"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
