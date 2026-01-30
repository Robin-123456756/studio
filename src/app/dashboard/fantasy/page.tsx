"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { myFantasyTeam, fantasyStandings } from "@/lib/data";
import { ArrowDown, ArrowUp, Minus, Shirt, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import AuthGate from "@/components/AuthGate";

type Player = {
  id: string;
  name: string; // full name
  webName?: string | null; // short display name
  position: "Goalkeeper" | "Defender" | "Midfielder" | "Forward" | string;
  price: number;
  points: number;
  avatarUrl?: string | null;
  isLady?: boolean;
  teamShort?: string | null;
  teamName?: string | null;
  didPlay?: boolean;
};

type ApiGameweek = {
  id: number;
  name?: string | null;
  deadline_time?: string | null;
  finalized?: boolean | null;
};

type ApiPlayer = {
  id: string;
  name: string;
  webName?: string | null;
  position?: string | null;
  price?: number | null;
  points?: number | null;
  avatarUrl?: string | null;
  isLady?: boolean | null;
  teamShort?: string | null;
  teamName?: string | null;
};

const LS_PICKS = "tbl_picked_player_ids";

function formatDeadlineUG(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);

  const s = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  }).format(d);

  return s
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM")
    .replace(/\ba\.m\.\b/i, "AM")
    .replace(/\bp\.m\.\b/i, "PM");
}

function normalizePosition(pos?: string | null): Player["position"] {
  const p = (pos ?? "").trim().toLowerCase();
  if (p === "gk" || p === "goalkeeper" || p === "keeper") return "Goalkeeper";
  if (p === "def" || p === "df" || p === "defender") return "Defender";
  if (p === "mid" || p === "mf" || p === "midfielder") return "Midfielder";
  if (p === "fwd" || p === "fw" || p === "forward" || p === "striker") return "Forward";
  return pos ?? "Midfielder";
}

function MiniLeague() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="px-4 pt-4 pb-2">
          <div className="text-base font-semibold">Mini-League</div>
          <div className="text-sm text-muted-foreground">Your rank among rivals.</div>
        </div>

        <div className="px-2 pb-3">
          <div className="space-y-1">
            {fantasyStandings.map((t) => {
              const isMe = t.name === myFantasyTeam.name;
              const trend =
                t.rank < myFantasyTeam.rank ? "up" : t.rank > myFantasyTeam.rank ? "down" : "same";

              return (
                <div
                  key={t.rank}
                  className={cn(
                    "flex items-center justify-between rounded-xl px-3 py-2",
                    isMe ? "bg-primary/15" : "bg-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-10 text-sm font-medium flex items-center gap-1">
                      {trend === "up" ? (
                        <ArrowUp className="h-4 w-4" />
                      ) : trend === "down" ? (
                        <ArrowDown className="h-4 w-4" />
                      ) : (
                        <Minus className="h-4 w-4" />
                      )}
                      <span className="tabular-nums">{t.rank}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{t.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.owner}</div>
                    </div>
                  </div>

                  <div className="text-sm font-bold font-mono tabular-nums">{t.points}</div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** ✅ Your actual fantasy main UI (only shows Pick Team / Transfers) */
function FantasyPage() {
  const [currentGW, setCurrentGW] = React.useState<ApiGameweek | null>(null);
  const [nextGW, setNextGW] = React.useState<ApiGameweek | null>(null);
  const [gwLoading, setGwLoading] = React.useState(true);
  const [gwError, setGwError] = React.useState<string | null>(null);

  // Load gameweeks
  React.useEffect(() => {
    (async () => {
      try {
        setGwLoading(true);
        setGwError(null);

        const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to load gameweeks");

        setCurrentGW(json.current ?? null);
        setNextGW(json.next ?? null);
      } catch (e: any) {
        setGwError(e?.message || "Unknown error");
      } finally {
        setGwLoading(false);
      }
    })();
  }, []);

  // (Optional) You can later replace this with DB-loaded team name
  const [teamName, setTeamName] = React.useState(myFantasyTeam.name);

  function editTeamName() {
    const next = window.prompt("Enter your team name:", teamName);
    if (!next) return;
    const cleaned = next.trim().slice(0, 30);
    if (!cleaned) return;
    setTeamName(cleaned);
    window.localStorage.setItem("tbl_team_name", cleaned);
  }

  React.useEffect(() => {
    const savedName = window.localStorage.getItem("tbl_team_name");
    if (savedName && savedName.trim().length > 0) setTeamName(savedName);
  }, []);

  // placeholders (your real numbers will later come from DB/views)
  const average = 29;
  const pointsThisGW = 34;
  const highest = 104;

  return (
    <div className="space-y-5 animate-in fade-in-50">
      {/* Top card */}
      <div
        className={cn(
          "rounded-3xl overflow-hidden",
          "bg-gradient-to-br from-sky-500 via-indigo-500 to-fuchsia-500"
        )}
      >
        <div className="p-4 text-white">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={editTeamName}
              className="flex items-center gap-3 rounded-2xl bg-white/10 px-3 py-2 hover:bg-white/15 active:bg-white/20"
              aria-label="Edit team name"
            >
              <div className="h-12 w-12 rounded-2xl bg-white/20 grid place-items-center">
                <Shirt className="h-6 w-6" />
              </div>
              <div className="text-left">
                <div className="text-xl font-bold leading-tight">{teamName}</div>
                <div className="text-sm text-white/80">{myFantasyTeam.owner}</div>
              </div>
            </button>

            <div className="text-white/80 text-sm">
              {gwLoading ? "GW ..." : `GW ${currentGW?.id ?? "—"}`}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-3xl font-extrabold tabular-nums">{average}</div>
              <div className="text-sm text-white/80">Average</div>
            </div>
            <div>
              <div className="text-5xl font-extrabold tabular-nums leading-none">
                {pointsThisGW}
              </div>
              <div className="text-sm text-white/80">Points</div>
            </div>
            <div>
              <div className="text-3xl font-extrabold tabular-nums">{highest}</div>
              <div className="text-sm text-white/80">Highest</div>
            </div>
          </div>

          <div className="mt-4 text-center">
            <div className="text-base text-white/85">
              {gwLoading ? "Gameweek ..." : `Gameweek ${nextGW?.id ?? "—"}`}
            </div>

            <div className="text-lg font-bold">
              {gwLoading ? "Deadline: ..." : `Deadline: ${formatDeadlineUG(nextGW?.deadline_time)}`}
            </div>

            {gwError ? <div className="mt-2 text-xs text-white/80">⚠ {gwError}</div> : null}
          </div>

          <div className="mt-4 space-y-3">
            <Button
              asChild
              className="w-full rounded-2xl bg-white/15 text-white hover:bg-white/20"
              variant="secondary"
            >
              <Link href="/dashboard/fantasy/pick-team">
                <span className="flex items-center justify-center gap-2">
                  <Shirt className="h-5 w-5" /> Pick Team
                </span>
              </Link>
            </Button>

            <Button
              asChild
              className="w-full rounded-2xl bg-white/15 text-white hover:bg-white/20"
              variant="secondary"
            >
              <Link href="/dashboard/transfers">
                <span className="flex items-center justify-center gap-2">
                  <ArrowLeftRight className="h-5 w-5" /> Transfers
                </span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <MiniLeague />
    </div>
  );
}

/** ✅ AUTH WRAPPER (this is what renders at /dashboard/fantasy) */
export default function FantasyRoute() {
  const [checking, setChecking] = React.useState(true);
  const [authed, setAuthed] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setAuthed(!!data.session);
      setChecking(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
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
    // AuthGate should handle sign in + sign up then call onAuthed
    return <AuthGate onAuthed={() => setAuthed(true)} />;
  }

  return <FantasyPage />;
}
