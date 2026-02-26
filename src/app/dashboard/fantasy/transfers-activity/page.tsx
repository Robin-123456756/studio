"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type TransferItem = {
  id: number;
  managerTeam: string;
  playerOut: { name: string; webName: string; position: string; teamShort: string };
  playerIn: { name: string; webName: string; position: string; teamShort: string };
  gameweekId: number;
  createdAt: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function TransfersActivityContent() {
  const [transfers, setTransfers] = React.useState<TransferItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/transfers/activity?limit=50", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load transfers");
        setTransfers(json.transfers ?? []);
      } catch (e: any) {
        setError(e?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
                href="/dashboard/fantasy"
                className="rounded-full p-2 hover:bg-white/10 active:bg-white/20 transition"
                aria-label="Back to Fantasy"
              >
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex-1">
                <div className="text-lg font-extrabold">Transfer Activity</div>
                <div className="text-xs text-white/70">Budo League Fantasy</div>
              </div>
              <ArrowLeftRight className="h-6 w-6 text-emerald-300" />
            </div>

            <div className="mt-4 flex items-center justify-center gap-6 pb-2">
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums">
                  {loading ? "—" : transfers.length}
                </div>
                <div className="text-[11px] text-white/60 font-semibold">
                  Total Transfers
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="mt-4 space-y-2">
        {loading ? (
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
            <CardContent className="p-4 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
        ) : error ? (
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
            <CardContent className="p-6 text-center text-sm text-red-500">
              {error}
            </CardContent>
          </Card>
        ) : transfers.length === 0 ? (
          <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No transfers yet. Activity will appear here once managers start making moves.
            </CardContent>
          </Card>
        ) : (
          transfers.map((t) => (
            <Card
              key={t.id}
              className="rounded-2xl shadow-[0_2px_10px_rgba(180,155,80,0.15)]"
            >
              <CardContent className="p-0">
                <div className="flex gap-3 p-3">
                  {/* Color indicator */}
                  <div className="w-1 self-stretch rounded-full bg-emerald-500 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      {t.managerTeam}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      <span className="text-red-500 font-medium">
                        {t.playerOut.webName}
                      </span>
                      {t.playerOut.position && (
                        <span className="text-muted-foreground">
                          {" "}({t.playerOut.position}{t.playerOut.teamShort ? `, ${t.playerOut.teamShort}` : ""})
                        </span>
                      )}
                      <span className="mx-1.5 text-muted-foreground/60">&rarr;</span>
                      <span className="text-emerald-600 font-medium">
                        {t.playerIn.webName}
                      </span>
                      {t.playerIn.position && (
                        <span className="text-muted-foreground">
                          {" "}({t.playerIn.position}{t.playerIn.teamShort ? `, ${t.playerIn.teamShort}` : ""})
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-[11px] text-muted-foreground/70">
                      GW{t.gameweekId} &middot; {timeAgo(t.createdAt)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── Auth Wrapper ──

export default function TransfersActivityRoute() {
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

  return <TransfersActivityContent />;
}
