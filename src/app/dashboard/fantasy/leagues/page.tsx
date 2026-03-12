"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, TrendingUp, TrendingDown, Minus, Trophy, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type LeagueSummary = {
  id: number;
  name: string;
  inviteCode: string;
  isGeneral: boolean;
  isCreator: boolean;
  memberCount: number;
  rank: number | null;
  totalPoints: number;
  movement: number;
};

function MovementArrow({ movement }: { movement: number }) {
  if (movement > 0) {
    return (
      <span className="flex items-center gap-0.5 text-emerald-500 text-xs font-semibold">
        <TrendingUp className="h-3.5 w-3.5" />
        {movement}
      </span>
    );
  }
  if (movement < 0) {
    return (
      <span className="flex items-center gap-0.5 text-red-500 text-xs font-semibold">
        <TrendingDown className="h-3.5 w-3.5" />
        {Math.abs(movement)}
      </span>
    );
  }
  return <Minus className="h-3.5 w-3.5 text-muted-foreground/50" />;
}

function LeagueRow({ league }: { league: LeagueSummary }) {
  return (
    <Link
      href={`/dashboard/fantasy/leagues/${league.id}`}
      className="flex items-center gap-3 px-4 py-3 transition hover:bg-muted/40 active:bg-muted/60"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">{league.name}</div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {league.rank != null && (
          <span className="text-sm font-bold tabular-nums text-muted-foreground">
            {league.rank}
          </span>
        )}
        <MovementArrow movement={league.movement} />
        <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
      </div>
    </Link>
  );
}

function LeaguesContent() {
  const [leagues, setLeagues] = React.useState<LeagueSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/mini-leagues", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load leagues");
        setLeagues(json.leagues ?? []);
      } catch (e: any) {
        setError(e?.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const invitational = leagues.filter((l) => !l.isGeneral);
  const general = leagues.filter((l) => l.isGeneral);

  return (
    <div className="mx-auto w-full max-w-app min-h-screen bg-muted/30 font-body flex flex-col">
      {/* Header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
        <div
          className={cn(
            "overflow-hidden rounded-b-3xl",
            "bg-gradient-to-br from-[#062C30] via-[#0D5C63] to-[#14919B]",
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
                <div className="text-lg font-extrabold">Leagues & Cups</div>
                <div className="text-xs text-white/70">Budo League Fantasy</div>
              </div>
              <Trophy className="h-6 w-6 text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3 mt-4">
        <Link
          href="/dashboard/fantasy/leagues/join"
          className="flex-1 rounded-xl bg-[#0D5C63] py-3 text-center text-sm font-bold text-white shadow transition hover:bg-[#0D5C63]/90 active:bg-[#0D5C63]/80"
        >
          + Join League
        </Link>
        <Link
          href="/dashboard/fantasy/leagues/create"
          className="flex-1 rounded-xl border-2 border-[#0D5C63] py-3 text-center text-sm font-bold text-[#0D5C63] transition hover:bg-[#0D5C63]/5 active:bg-[#0D5C63]/10"
        >
          Create League
        </Link>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 text-center text-sm text-red-500">{error}</div>
      )}

      {!loading && !error && (
        <>
          {/* Invitational Leagues */}
          <div className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1">
              Invitational Leagues
            </h2>
            <p className="text-[10px] text-muted-foreground px-1 mb-2">
              Private leagues you create or join with an invite code
            </p>
            <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)] overflow-hidden">
              {invitational.length === 0 ? (
                <CardContent className="py-6 text-center text-sm text-muted-foreground">
                  No invitational leagues yet. Create one or join with an invite code!
                </CardContent>
              ) : (
                <div className="divide-y divide-border">
                  {invitational.map((league) => (
                    <LeagueRow key={league.id} league={league} />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* General Leagues */}
          {general.length > 0 && (
            <div className="mt-6 mb-6">
              <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground px-1 mb-1">
                General Leagues
              </h2>
              <p className="text-[10px] text-muted-foreground px-1 mb-2">
                Everyone is automatically entered — compete against all managers
              </p>
              <Card className="rounded-2xl shadow-[0_4px_20px_rgba(180,155,80,0.25)] overflow-hidden">
                <div className="divide-y divide-border">
                  {general.map((league) => (
                    <LeagueRow key={league.id} league={league} />
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function LeaguesRoute() {
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

  return <LeaguesContent />;
}
