"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trophy,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Minus,
  LogOut,
} from "lucide-react";
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

type StandingsEntry = {
  rank: number;
  userId: string;
  teamName: string;
  totalPoints: number;
  gwBreakdown: Record<number, number>;
  movement: number;
};

type H2HStandingsEntry = {
  rank: number;
  userId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  h2hPoints: number;
  movement: number;
};

type H2HFixtureResult = {
  gameweekId: number;
  user1Id: string;
  user2Id: string | null;
  user1Name: string;
  user2Name: string | null;
  user1Points: number;
  user2Points: number;
  result: "win" | "loss" | "draw" | "bye";
};

type LeagueInfo = {
  id: number;
  name: string;
  inviteCode: string;
  isGeneral: boolean;
  isCreator: boolean;
  leagueType: "classic" | "h2h";
  memberCount: number;
};

function rankColor(rank: number) {
  if (rank === 1) return "text-amber-500";
  if (rank === 2) return "text-gray-400";
  if (rank === 3) return "text-amber-700";
  return "text-muted-foreground";
}

function rankLabel(rank: number) {
  if (rank === 1) return "\u{1F947}";
  if (rank === 2) return "\u{1F948}";
  if (rank === 3) return "\u{1F949}";
  return String(rank);
}

function latestGwPoints(gw: Record<number, number>): number | null {
  const keys = Object.keys(gw).map(Number);
  if (keys.length === 0) return null;
  const latest = Math.max(...keys);
  return gw[latest] ?? null;
}

function MovementCell({ movement }: { movement: number }) {
  if (movement > 0) {
    return (
      <span className="flex items-center justify-center gap-0.5 text-emerald-500">
        <TrendingUp className="h-3 w-3" />
        <span className="text-xs font-semibold">{movement}</span>
      </span>
    );
  }
  if (movement < 0) {
    return (
      <span className="flex items-center justify-center gap-0.5 text-red-500">
        <TrendingDown className="h-3 w-3" />
        <span className="text-xs font-semibold">{Math.abs(movement)}</span>
      </span>
    );
  }
  return <Minus className="h-3 w-3 text-muted-foreground/40 mx-auto" />;
}

function LeagueStandingsContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [league, setLeague] = React.useState<LeagueInfo | null>(null);
  const [standings, setStandings] = React.useState<StandingsEntry[]>([]);
  const [h2hStandings, setH2hStandings] = React.useState<H2HStandingsEntry[]>([]);
  const [h2hFixtures, setH2hFixtures] = React.useState<H2HFixtureResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [leaving, setLeaving] = React.useState(false);

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
        const res = await fetch(`/api/mini-leagues/${id}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load league");
        setLeague(json.league);
        if (json.league?.leagueType === "h2h") {
          setH2hStandings(json.standings ?? []);
          setH2hFixtures(json.currentGwFixtures ?? []);
        } else {
          setStandings(json.standings ?? []);
        }
      } catch (e: any) {
        setError(e?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const isH2H = league?.leagueType === "h2h";
  const userEntry = isH2H
    ? h2hStandings.find((s) => s.userId === userId)
    : standings.find((s) => s.userId === userId);
  const userH2HEntry = isH2H ? h2hStandings.find((s) => s.userId === userId) : null;
  const totalEntries = isH2H ? h2hStandings.length : standings.length;

  async function copyInviteLink() {
    if (!league) return;
    const url = `${window.location.origin}/dashboard/fantasy/leagues/join?code=${league.inviteCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function handleLeave() {
    if (!league) return;
    if (!window.confirm(`Leave "${league.name}"? You can rejoin later with the invite code.`)) {
      return;
    }

    try {
      setLeaving(true);
      const res = await fetch(`/api/mini-leagues/${id}/leave`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to leave league");
      window.location.href = "/dashboard/fantasy/leagues";
    } catch (e: any) {
      setError(e?.message || "Failed to leave");
      setLeaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-app min-h-screen bg-muted/30 font-body flex flex-col">
      {/* Header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
        <div
          className={cn(
            "overflow-hidden rounded-b-3xl",
            "bg-gradient-to-br from-[#062C30] via-[#0D5C63] to-[#14919B]",
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
                <div className="text-lg font-extrabold">
                  {loading ? "Loading..." : league?.name ?? "League"}
                </div>
                <div className="text-xs text-white/70">
                  {league ? `${league.memberCount} managers` : "Budo League Fantasy"}
                </div>
              </div>
              <Trophy className="h-6 w-6 text-amber-400" />
            </div>

            {/* User stats summary */}
            {!loading && userEntry && (
              <div className="mt-4 flex items-center justify-center gap-6 pb-2">
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">
                    {totalEntries}
                  </div>
                  <div className="text-[11px] text-white/60 font-semibold">Managers</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">
                    {userEntry.rank}
                    <span className="text-sm font-semibold text-white/70">
                      /{totalEntries}
                    </span>
                  </div>
                  <div className="text-[11px] text-white/60 font-semibold">Your Rank</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold tabular-nums">
                    {isH2H && userH2HEntry ? userH2HEntry.h2hPoints : (userEntry as StandingsEntry).totalPoints}
                  </div>
                  <div className="text-[11px] text-white/60 font-semibold">
                    {isH2H ? "H2H Pts" : "Your Points"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite code share (for creator or anyone really) */}
      {league && !league.isGeneral && (
        <div className="mt-4">
          <button
            onClick={copyInviteLink}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 text-sm font-semibold text-[#0D5C63] shadow-sm transition hover:bg-muted/40"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy Invite Link &middot; {league.inviteCode}
              </>
            )}
          </button>
        </div>
      )}

      {/* Standings table */}
      <div className="mt-4">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <div className="p-6 text-center text-sm text-red-500">{error}</div>
            ) : isH2H ? (
              h2hStandings.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No standings yet. Data will appear once gameweeks are played.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8 text-center">#</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead className="w-8 text-center">P</TableHead>
                        <TableHead className="w-8 text-center">W</TableHead>
                        <TableHead className="w-8 text-center">D</TableHead>
                        <TableHead className="w-8 text-center">L</TableHead>
                        <TableHead className="w-14 text-right pr-4">Pts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {h2hStandings.map((entry) => {
                        const isUser = entry.userId === userId;
                        return (
                          <TableRow
                            key={entry.userId}
                            className={cn(
                              "cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70",
                              isUser &&
                                "bg-[#0D5C63]/8 border-l-[3px] border-l-[#0D5C63]"
                            )}
                            onClick={() => {
                              if (isUser) {
                                router.push("/dashboard/fantasy/points");
                              } else {
                                router.push(`/dashboard/fantasy/points?view=manager&user_id=${entry.userId}`);
                              }
                            }}
                          >
                            <TableCell className="text-center font-bold">
                              <span className={rankColor(entry.rank)}>
                                {rankLabel(entry.rank)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-sm leading-tight truncate max-w-[120px]">
                                {entry.teamName}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {entry.pointsFor} pts scored
                              </div>
                            </TableCell>
                            <TableCell className="text-center tabular-nums text-sm">{entry.played}</TableCell>
                            <TableCell className="text-center tabular-nums text-sm text-emerald-600 font-semibold">{entry.won}</TableCell>
                            <TableCell className="text-center tabular-nums text-sm">{entry.drawn}</TableCell>
                            <TableCell className="text-center tabular-nums text-sm text-red-500">{entry.lost}</TableCell>
                            <TableCell className="text-right pr-4 font-bold tabular-nums text-sm">{entry.h2hPoints}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : standings.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No standings yet. Data will appear once gameweeks are played.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-center">#</TableHead>
                    <TableHead>Team</TableHead>
                    <TableHead className="w-10 text-center">
                      <TrendingUp className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                    </TableHead>
                    <TableHead className="w-14 text-center">GW</TableHead>
                    <TableHead className="w-16 text-right pr-4">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {standings.map((entry) => {
                    const isUser = entry.userId === userId;
                    const gwPts = latestGwPoints(entry.gwBreakdown);

                    return (
                      <TableRow
                        key={entry.userId}
                        className={cn(
                          "cursor-pointer transition-colors hover:bg-muted/50 active:bg-muted/70",
                          isUser &&
                            "bg-[#0D5C63]/8 border-l-[3px] border-l-[#0D5C63]"
                        )}
                        onClick={() => {
                          if (isUser) {
                            router.push("/dashboard/fantasy/points");
                          } else {
                            router.push(`/dashboard/fantasy/points?view=manager&user_id=${entry.userId}`);
                          }
                        }}
                      >
                        <TableCell className="text-center font-bold">
                          <span className={rankColor(entry.rank)}>
                            {rankLabel(entry.rank)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm leading-tight truncate max-w-[140px]">
                            {entry.teamName}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <MovementCell movement={entry.movement} />
                        </TableCell>
                        <TableCell className="text-center tabular-nums text-sm">
                          {gwPts ?? "\u2014"}
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

      {/* This GW's Matchups (H2H only) */}
      {isH2H && !loading && h2hFixtures.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-bold text-foreground mb-2">
            This GW&apos;s Matchups
          </div>
          <div className="space-y-2">
            {h2hFixtures.map((fix, i) => (
              <Card key={i} className="rounded-xl shadow-sm">
                <CardContent className="p-3">
                  {fix.user2Id === null ? (
                    <div className="flex items-center justify-center text-sm text-muted-foreground">
                      <span className="font-semibold text-foreground">{fix.user1Name}</span>
                      <span className="mx-2">—</span>
                      <span className="italic">Bye</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className={cn(
                        "flex-1 text-sm font-semibold truncate text-right pr-2",
                        fix.user1Id === userId && "text-[#0D5C63]"
                      )}>
                        {fix.user1Name}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={cn(
                          "min-w-[28px] text-center rounded-md py-0.5 text-sm font-bold tabular-nums",
                          fix.result === "win" ? "bg-emerald-100 text-emerald-700" :
                          fix.result === "loss" ? "bg-red-100 text-red-700" :
                          "bg-muted text-foreground"
                        )}>
                          {fix.user1Points}
                        </span>
                        <span className="text-xs text-muted-foreground">v</span>
                        <span className={cn(
                          "min-w-[28px] text-center rounded-md py-0.5 text-sm font-bold tabular-nums",
                          fix.result === "loss" ? "bg-emerald-100 text-emerald-700" :
                          fix.result === "win" ? "bg-red-100 text-red-700" :
                          "bg-muted text-foreground"
                        )}>
                          {fix.user2Points}
                        </span>
                      </div>
                      <div className={cn(
                        "flex-1 text-sm font-semibold truncate pl-2",
                        fix.user2Id === userId && "text-[#0D5C63]"
                      )}>
                        {fix.user2Name}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Leave league button */}
      {league && !league.isGeneral && (
        <div className="mt-6 mb-8">
          <button
            onClick={handleLeave}
            disabled={leaving}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 py-3 text-sm font-semibold text-red-500 transition hover:bg-red-50 active:bg-red-100 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4" />
            {leaving ? "Leaving..." : "Leave League"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function LeagueStandingsRoute() {
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

  return <LeagueStandingsContent />;
}
