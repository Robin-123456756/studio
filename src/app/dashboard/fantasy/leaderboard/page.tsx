"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

type LeaderboardEntry = {
  rank: number;
  userId: string;
  teamName: string;
  totalPoints: number;
  gwBreakdown: Record<number, number>;
};

function rankColor(rank: number) {
  if (rank === 1) return "text-amber-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-700";
  return "text-muted-foreground";
}

function rankLabel(rank: number) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return String(rank);
}

function gwBreakdownText(gw: Record<number, number>): string {
  const keys = Object.keys(gw)
    .map(Number)
    .sort((a, b) => a - b);
  if (keys.length === 0) return "";
  return keys.map((k) => `GW${k}: ${gw[k]}`).join(" · ");
}

function latestGwPoints(gw: Record<number, number>): number | null {
  const keys = Object.keys(gw).map(Number);
  if (keys.length === 0) return null;
  const latest = Math.max(...keys);
  return gw[latest] ?? null;
}

// ── Leaderboard Content ──

function LeaderboardContent() {
  const [entries, setEntries] = React.useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      setUserId(data.session?.user.id ?? null);
    })();
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/fantasy-leaderboard", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load leaderboard");
        setEntries(json.leaderboard ?? []);
      } catch (e: any) {
        setError(e?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const userEntry = entries.find((e) => e.userId === userId);

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
                <div className="text-lg font-extrabold">Leaderboard</div>
                <div className="text-xs text-white/70">Budo League Fantasy</div>
              </div>
              <Trophy className="h-6 w-6 text-amber-400" />
            </div>

            <div className="mt-4 flex items-center justify-center gap-6 pb-2">
              <div className="text-center">
                <div className="text-2xl font-bold tabular-nums">
                  {loading ? "—" : entries.length}
                </div>
                <div className="text-[11px] text-white/60 font-semibold">Managers</div>
              </div>
              {userEntry && (
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">
                    {userEntry.rank}
                    <span className="text-sm font-semibold text-white/70">
                      /{entries.length}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/60 font-semibold">Your Rank</div>
                </div>
              )}
              {userEntry && (
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">
                    {userEntry.totalPoints}
                  </div>
                  <div className="text-[11px] text-white/60 font-semibold">Your Points</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 px-0">
        <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)]">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-sm text-red-500">{error}</div>
            ) : entries.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No league standings yet. Data will appear once gameweeks are played.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="w-14 text-center">GW</TableHead>
                    <TableHead className="w-16 text-right pr-4">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const isUser = entry.userId === userId;
                    const gwPts = latestGwPoints(entry.gwBreakdown);
                    const breakdown = gwBreakdownText(entry.gwBreakdown);

                    return (
                      <TableRow
                        key={entry.userId}
                        className={cn(
                          isUser &&
                            "bg-[#0D5C63]/8 border-l-[3px] border-l-[#0D5C63]"
                        )}
                      >
                        <TableCell className="text-center font-bold">
                          <span className={rankColor(entry.rank)}>
                            {rankLabel(entry.rank)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm leading-tight">
                            {entry.teamName}
                          </div>
                          {breakdown && (
                            <div className="text-[11px] text-muted-foreground leading-tight mt-0.5 max-w-[200px] truncate">
                              {breakdown}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center tabular-nums text-sm">
                          {gwPts ?? "—"}
                        </TableCell>
                        <TableCell className="text-right pr-4 font-bold tabular-nums text-sm">
                          {entry.totalPoints}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Auth Wrapper (same pattern as points/page.tsx) ──

export default function LeaderboardRoute() {
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

  return <LeaderboardContent />;
}
