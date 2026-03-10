"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";
import { ArrowLeft, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type CupRound = {
  id: number;
  round_number: number;
  round_name: string;
  gameweek_id: number | null;
};

type CupMatch = {
  id: number;
  roundId: number;
  user1Id: string | null;
  user2Id: string | null;
  user1Name: string;
  user2Name: string;
  user1Points: number;
  user2Points: number;
  winnerId: string | null;
  isBye: boolean;
};

// ── Match Card ──

function MatchCard({
  match,
  currentUserId,
  onTapUser,
}: {
  match: CupMatch;
  currentUserId: string | null;
  onTapUser: (userId: string) => void;
}) {
  const isUser1 = match.user1Id === currentUserId;
  const isUser2 = match.user2Id === currentUserId;
  const isDecided = !!match.winnerId;

  if (match.isBye) {
    return (
      <div className="rounded-xl border bg-card/80 p-3">
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <span
            className={cn("font-semibold", isUser1 && "text-[#0D5C63]")}
            onClick={() => match.user1Id && onTapUser(match.user1Id)}
          >
            {match.user1Name}
          </span>
          <span className="text-xs italic">— Bye</span>
        </div>
      </div>
    );
  }

  const isTBD = !match.user1Id || match.user2Name === "TBD";

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-stretch">
        {/* User 1 */}
        <button
          type="button"
          onClick={() => match.user1Id && onTapUser(match.user1Id)}
          disabled={!match.user1Id}
          className={cn(
            "flex-1 py-3 px-3 text-right text-sm font-semibold truncate transition",
            isUser1 && "text-[#0D5C63]",
            isDecided && match.winnerId === match.user1Id && "bg-emerald-50",
            isDecided && match.winnerId !== match.user1Id && match.winnerId && "opacity-50",
          )}
        >
          {match.user1Name}
        </button>

        {/* Score */}
        <div className="flex items-center gap-1 px-2 bg-muted/30 shrink-0">
          {isTBD ? (
            <span className="text-xs text-muted-foreground">vs</span>
          ) : (
            <>
              <span
                className={cn(
                  "min-w-[24px] text-center rounded py-0.5 text-xs font-bold tabular-nums",
                  isDecided && match.winnerId === match.user1Id
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-foreground"
                )}
              >
                {match.user1Points}
              </span>
              <span className="text-[10px] text-muted-foreground">v</span>
              <span
                className={cn(
                  "min-w-[24px] text-center rounded py-0.5 text-xs font-bold tabular-nums",
                  isDecided && match.winnerId === match.user2Id
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-muted text-foreground"
                )}
              >
                {match.user2Points}
              </span>
            </>
          )}
        </div>

        {/* User 2 */}
        <button
          type="button"
          onClick={() => match.user2Id && onTapUser(match.user2Id)}
          disabled={!match.user2Id}
          className={cn(
            "flex-1 py-3 px-3 text-left text-sm font-semibold truncate transition",
            isUser2 && "text-[#0D5C63]",
            isDecided && match.winnerId === match.user2Id && "bg-emerald-50",
            isDecided && match.winnerId !== match.user2Id && match.winnerId && "opacity-50",
          )}
        >
          {match.user2Name}
        </button>
      </div>
    </div>
  );
}

// ── Cup Content ──

function CupContent() {
  const router = useRouter();
  const [rounds, setRounds] = React.useState<CupRound[]>([]);
  const [matches, setMatches] = React.useState<CupMatch[]>([]);
  const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeRound, setActiveRound] = React.useState<number | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/cup", { credentials: "same-origin" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load cup");

        setRounds(json.rounds ?? []);
        setMatches(json.matches ?? []);
        setCurrentUserId(json.currentUserId ?? null);

        // Default to the latest round that has decided matches, or round 1
        const decidedRounds = (json.matches ?? [])
          .filter((m: CupMatch) => m.winnerId)
          .map((m: CupMatch) => m.roundId);
        const roundsWithResults = (json.rounds ?? []).filter((r: CupRound) =>
          decidedRounds.includes(r.id)
        );
        const latestPlayed = roundsWithResults[roundsWithResults.length - 1];
        setActiveRound(latestPlayed?.id ?? json.rounds?.[0]?.id ?? null);
      } catch (e: any) {
        setError(e?.message || "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeRoundData = rounds.find((r) => r.id === activeRound);
  const roundMatches = matches.filter((m) => m.roundId === activeRound);

  // Find user's match in current round
  const userMatch = matches.find(
    (m) =>
      m.roundId === activeRound &&
      (m.user1Id === currentUserId || m.user2Id === currentUserId)
  );

  function handleTapUser(userId: string) {
    if (userId === currentUserId) {
      router.push("/dashboard/fantasy/points");
    } else {
      router.push(`/dashboard/fantasy/points?view=manager&user_id=${userId}`);
    }
  }

  return (
    <div className="mx-auto w-full max-w-app min-h-screen bg-muted/30 font-body flex flex-col">
      {/* Header */}
      <div className="-mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6">
        <div
          className={cn(
            "overflow-hidden rounded-b-3xl",
            "bg-gradient-to-br from-[#1a0a2e] via-[#37003C] to-[#6b1d5e]",
            "shadow-[0_8px_30px_rgba(180,155,80,0.35)]"
          )}
        >
          <div className="p-4 text-white">
            <div className="flex items-center gap-3 mb-3">
              <Link
                href="/dashboard/fantasy"
                className="h-9 w-9 rounded-full bg-white/10 grid place-items-center hover:bg-white/20"
                aria-label="Back to Fantasy"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex-1">
                <div className="text-lg font-extrabold">Budo Cup</div>
                <div className="text-xs text-white/70">Knockout Competition</div>
              </div>
              <Trophy className="h-6 w-6 text-amber-400" />
            </div>

            {/* User status */}
            {!loading && userMatch && (
              <div className="text-center pb-2">
                <div className="text-xs text-white/60 font-semibold">
                  {activeRoundData?.round_name ?? "Current Round"}
                </div>
                <div className="text-sm font-bold mt-1">
                  {userMatch.winnerId === currentUserId
                    ? "You advanced!"
                    : userMatch.winnerId && userMatch.winnerId !== currentUserId
                      ? "Eliminated"
                      : "In Progress"}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Round Tabs */}
      {rounds.length > 0 && (
        <div className="mt-4 px-0">
          <div className="flex gap-2 overflow-x-auto pb-2 px-1 no-scrollbar">
            {rounds.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRound(r.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  activeRound === r.id
                    ? "bg-[#37003C] text-white"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {r.round_name}
                {r.gameweek_id && (
                  <span className="ml-1 text-[10px] opacity-70">GW{r.gameweek_id}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matches */}
      <div className="mt-3 space-y-2">
        {loading ? (
          <div className="text-center py-16 text-sm text-muted-foreground">
            Loading cup...
          </div>
        ) : error ? (
          <div className="text-center py-16 text-sm text-red-500">{error}</div>
        ) : rounds.length === 0 ? (
          <Card className="rounded-2xl">
            <CardContent className="p-6 text-center">
              <Trophy className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <div className="text-sm text-muted-foreground">
                The Budo Cup hasn&apos;t started yet. Check back soon!
              </div>
            </CardContent>
          </Card>
        ) : roundMatches.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            No matches for this round yet.
          </div>
        ) : (
          roundMatches.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              currentUserId={currentUserId}
              onTapUser={handleTapUser}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Auth Wrapper ──

export default function CupRoute() {
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

  return <CupContent />;
}
