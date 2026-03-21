"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { Card, CardContent } from "@/components/ui/card";

type CreatedLeague = {
  id: number;
  name: string;
  invite_code: string;
};

function CreateLeagueContent() {
  const [name, setName] = React.useState("");
  const [leagueType, setLeagueType] = React.useState<"classic" | "h2h">("classic");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [created, setCreated] = React.useState<CreatedLeague | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/mini-leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: trimmed, leagueType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create league");

      setCreated(json.league);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  function getShareUrl() {
    if (!created) return "";
    return `${window.location.origin}/dashboard/fantasy/leagues/join?code=${created.invite_code}`;
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(getShareUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select text
    }
  }

  function shareWhatsApp() {
    const text = `Join my fantasy league "${created?.name}" on Budo League!\n${getShareUrl()}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  return (
    <div className="mx-auto w-full max-w-app min-h-screen bg-muted/30 font-body flex flex-col">
      {/* Header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
        <div
          className={cn(
            "overflow-hidden rounded-b-3xl",
            "bg-[#0D5C63]",
            "shadow-sm"
          )}
        >
          <div className="p-4 text-white">
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/fantasy/leagues"
                className="rounded-full p-2 hover:bg-white/10 active:bg-white/20 transition"
                aria-label="Back to Leagues"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex-1">
                <div className="text-lg font-extrabold">Create League</div>
                <div className="text-xs text-white/70">Start a private league</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {!created ? (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="league-name"
                    className="block text-sm font-semibold text-foreground mb-1.5"
                  >
                    League Name
                  </label>
                  <input
                    id="league-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. The Kickback League"
                    maxLength={50}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#0D5C63]/50 transition"
                    autoFocus
                  />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {name.trim().length}/50 characters
                  </div>
                </div>

                {/* League type toggle */}
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    League Type
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setLeagueType("classic")}
                      className={cn(
                        "rounded-xl border-2 py-3 px-4 text-left transition",
                        leagueType === "classic"
                          ? "border-[#0D5C63] bg-[#0D5C63]/5"
                          : "border-border bg-background"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-bold",
                        leagueType === "classic" ? "text-[#0D5C63]" : "text-foreground"
                      )}>
                        Classic
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Total points across all GWs
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeagueType("h2h")}
                      className={cn(
                        "rounded-xl border-2 py-3 px-4 text-left transition",
                        leagueType === "h2h"
                          ? "border-[#0D5C63] bg-[#0D5C63]/5"
                          : "border-border bg-background"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-bold",
                        leagueType === "h2h" ? "text-[#0D5C63]" : "text-foreground"
                      )}>
                        Head-to-Head
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Face a rival each GW. W=3, D=1
                      </div>
                    </button>
                  </div>
                  {leagueType === "h2h" && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      Max 20 managers. Fixtures auto-generated each gameweek.
                    </div>
                  )}
                </div>

                {error && (
                  <div className="text-sm text-red-500 font-medium">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={!name.trim() || submitting}
                  className={cn(
                    "w-full rounded-xl py-3 text-sm font-bold text-white shadow transition",
                    !name.trim() || submitting
                      ? "bg-muted-foreground/30 cursor-not-allowed"
                      : "bg-[#0D5C63] hover:bg-[#0D5C63]/90 active:bg-[#0D5C63]/80"
                  )}
                >
                  {submitting ? "Creating..." : "Create League"}
                </button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-5 space-y-5">
              <div className="text-center">
                <div className="text-lg font-extrabold text-foreground">
                  {created.name}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  League created successfully!
                </div>
              </div>

              {/* Invite code display */}
              <div className="rounded-xl bg-muted/60 p-4 text-center">
                <div className="text-xs font-semibold text-muted-foreground mb-1">
                  Invite Code
                </div>
                <div className="text-2xl font-extrabold tracking-widest text-foreground">
                  {created.invite_code}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={copyLink}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border-2 border-[#0D5C63] py-3 text-sm font-bold text-[#0D5C63] transition hover:bg-[#0D5C63]/5"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copy Invite Link
                    </>
                  )}
                </button>

                <button
                  onClick={shareWhatsApp}
                  className="w-full rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white shadow transition hover:bg-[#25D366]/90"
                >
                  Share on WhatsApp
                </button>

                <Link
                  href={`/dashboard/fantasy/leagues/${created.id}`}
                  className="block w-full rounded-xl bg-[#0D5C63] py-3 text-center text-sm font-bold text-white shadow transition hover:bg-[#0D5C63]/90"
                >
                  View League
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function CreateLeagueRoute() {
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session?.user);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session?.user);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (checking) {
    return (
      <div className="mx-auto w-full max-w-md px-4 pt-10 text-sm text-muted-foreground">
        Checking session...
      </div>
    );
  }

  if (!authed) {
    return <AuthGate onAuthed={() => setAuthed(true)} />;
  }

  return <CreateLeagueContent />;
}
