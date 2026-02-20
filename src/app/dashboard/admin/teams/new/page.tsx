"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminNewTeamPage() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [shortName, setShortName] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim() || !shortName.trim()) {
      setError("Name and short name are required.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          short_name: shortName.trim(),
          logo_url: logoUrl.trim() || null,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to create team.");
        setSubmitting(false);
        return;
      }

      setSuccess("Team created successfully!");
      setName("");
      setShortName("");
      setLogoUrl("");

      setTimeout(() => {
        router.push("/dashboard/teams");
      }, 800);
    } catch (err: any) {
      setError(err?.message || "Unexpected error creating team.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">New Club</h1>
          <p className="text-sm text-muted-foreground">
            Add a new club to the Budo League.
          </p>
        </div>

        <Button asChild variant="outline" className="rounded-2xl">
          <Link href="/dashboard/teams">Back</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Club details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Club Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Manchester United"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="shortName">Short Name</Label>
              <Input
                id="shortName"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="e.g. MUN"
                required
              />
              <p className="text-[11px] text-muted-foreground">
                3-letter abbreviation shown in tables and fixtures.
              </p>
            </div>

            <div className="space-y-1">
              <Label htmlFor="logoUrl">Logo URL (optional)</Label>
              <Input
                id="logoUrl"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-emerald-500">{success}</p>}

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" className="rounded-2xl" disabled={submitting}>
                {submitting ? "Saving..." : "Create Club"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-2xl"
                onClick={() => router.push("/dashboard/teams")}
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
