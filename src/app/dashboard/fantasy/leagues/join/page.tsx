"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { Card, CardContent } from "@/components/ui/card";

type JoinedLeague = { id: number; name: string };

function JoinLeagueContent() {
  const searchParams = useSearchParams();
  const codeFromUrl = searchParams.get("code") ?? "";

  const [code, setCode] = React.useState(codeFromUrl);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [joined, setJoined] = React.useState<JoinedLeague | null>(null);

  // Auto-submit if code comes from URL
  const autoSubmitted = React.useRef(false);
  React.useEffect(() => {
    if (codeFromUrl && !autoSubmitted.current) {
      autoSubmitted.current = true;
      handleJoin(codeFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeFromUrl]);

  async function handleJoin(inviteCode?: string) {
    const codeToUse = inviteCode ?? code;
    const trimmed = codeToUse.trim();
    if (!trimmed) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/mini-leagues/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ code: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to join league");

      setJoined(json.league);
    } catch (e: any) {
      setError(e?.message || "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleJoin();
  }

  return (
    <div className="mx-auto w-full max-w-app min-h-screen bg-muted/30 font-body flex flex-col">
      {/* Header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
        <div
          className={cn(
            "overflow-hidden rounded-b-3xl",
            "bg-[#0D5C63]",
            "shadow-[0_8px_30px_rgba(180,155,80,0.35)]"
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
                <div className="text-lg font-extrabold">Join League</div>
                <div className="text-xs text-white/70">Enter an invite code</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        {!joined ? (
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="invite-code"
                    className="block text-sm font-semibold text-foreground mb-1.5"
                  >
                    Invite Code
                  </label>
                  <input
                    id="invite-code"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. BUDO-7X3K"
                    maxLength={9}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm font-mono tracking-wider text-center outline-none focus:ring-2 focus:ring-[#0D5C63]/50 transition uppercase"
                    autoFocus
                  />
                  <div className="mt-1.5 text-xs text-muted-foreground text-center">
                    Ask the league creator for the invite code
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-red-500 font-medium text-center">{error}</div>
                )}

                <button
                  type="submit"
                  disabled={!code.trim() || submitting}
                  className={cn(
                    "w-full rounded-xl py-3 text-sm font-bold text-white shadow transition",
                    !code.trim() || submitting
                      ? "bg-muted-foreground/30 cursor-not-allowed"
                      : "bg-[#0D5C63] hover:bg-[#0D5C63]/90 active:bg-[#0D5C63]/80"
                  )}
                >
                  {submitting ? "Joining..." : "Join League"}
                </button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
            <CardContent className="p-5 space-y-5 text-center">
              <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto" />
              <div>
                <div className="text-lg font-extrabold text-foreground">
                  You&apos;re in!
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Joined <span className="font-semibold">{joined.name}</span>
                </div>
              </div>

              <Link
                href={`/dashboard/fantasy/leagues/${joined.id}`}
                className="block w-full rounded-xl bg-[#0D5C63] py-3 text-center text-sm font-bold text-white shadow transition hover:bg-[#0D5C63]/90"
              >
                View Standings
              </Link>
              <Link
                href="/dashboard/fantasy/leagues"
                className="block w-full text-center text-sm font-semibold text-[#0D5C63]"
              >
                Back to Leagues
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function JoinLeagueRoute() {
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setAuthed(!!data.user);
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

  return (
    <React.Suspense
      fallback={
        <div className="mx-auto w-full max-w-md px-4 pt-10 text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <JoinLeagueContent />
    </React.Suspense>
  );
}
