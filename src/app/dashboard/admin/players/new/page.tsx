"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { teams } from "@/lib/data";

const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const;

export default function AdminNewPlayerPage() {
  const router = useRouter();

  // form state
  const [name, setName] = React.useState("");
  const [position, setPosition] = React.useState<string>("Midfielder");
  const [teamId, setTeamId] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [price, setPrice] = React.useState("0");
  const [points, setPoints] = React.useState("0");

  // admin password (for x-admin-password header)
  const [adminPassword, setAdminPassword] = React.useState("");
  const [rememberPassword, setRememberPassword] = React.useState(true);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  // Load saved admin password from localStorage (nice for you as the admin)
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("tbl_admin_password");
    if (saved) {
      setAdminPassword(saved);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!adminPassword.trim()) {
      setError("Admin password is required.");
      return;
    }
    if (!name.trim() || !position || !teamId.trim()) {
      setError("Name, position and team are required.");
      return;
    }

    setSubmitting(true);
    try {
      if (rememberPassword && typeof window !== "undefined") {
        window.localStorage.setItem("tbl_admin_password", adminPassword);
      }

      const res = await fetch("/api/admin/players", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({
          name: name.trim(),
          position,
          // 👇 IMPORTANT: this should match how you store team_id in Supabase
          // Right now we use team.id as the code/value
          team_id: teamId.trim(),
          avatar_url: avatarUrl.trim() || null,
          price: Number(price || 0),
          points: Number(points || 0),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to create player.");
        setSubmitting(false);
        return;
      }

      setSuccess("Player created successfully!");
      setError(null);

      // optional: reset form (you can remove this if you prefer to stay filled)
      setName("");
      setAvatarUrl("");
      setPrice("0");
      setPoints("0");
      setPosition("Midfielder");
      setTeamId("");

      // after a short delay, go back to the players admin list
      setTimeout(() => {
        router.push("/dashboard/admin/players");
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Unexpected error creating player.");
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">New Player</h1>
          <p className="text-sm text-muted-foreground">
            Create a player without using the Supabase dashboard.
          </p>
        </div>

        <Button asChild variant="outline" className="rounded-2xl">
          <Link href="/dashboard/admin/players">Back</Link>
        </Button>
      </div>

      {/* Admin password card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admin access</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="adminPassword">Admin password (x-admin-password)</Label>
            <Input
              id="adminPassword"
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Enter ADMIN_PASSWORD from env"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={rememberPassword}
              onChange={(e) => setRememberPassword(e.target.checked)}
            />
            Remember on this device
          </label>
          <p className="text-[11px] text-muted-foreground">
            This password is checked by <code>/api/admin/players</code> using the{" "}
            <code>ADMIN_PASSWORD</code> environment variable.
          </p>
        </CardContent>
      </Card>

      {/* Player form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Player details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Lionel Messi"
                required
              />
            </div>

            {/* Position + Team */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="position">Position</Label>
                <select
                  id="position"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                >
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="team">Team</Label>
                <select
                  id="team"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  required
                >
                  <option value="">Select team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {/* if you later add t.code, you can show it here too */}
                      {t.name} ({t.id})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  This value is sent as <code>team_id</code> to Supabase.  
                  Make sure your <code>players.team_id</code> column stores the same string
                  (for example <code>p-001</code>, <code>AUS</code>, etc.).
                </p>
              </div>
            </div>

            {/* Avatar URL */}
            <div className="space-y-1">
              <Label htmlFor="avatarUrl">Avatar URL (optional)</Label>
              <Input
                id="avatarUrl"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* Price + Points */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="price">Price (millions)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.5"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  step="1"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                />
              </div>
            </div>

            {/* Messages */}
            {error && (
              <p className="text-sm text-red-500">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-emerald-500">
                {success}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" className="rounded-2xl" disabled={submitting}>
                {submitting ? "Saving..." : "Create player"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-2xl"
                onClick={() => router.push("/dashboard/admin/players")}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
