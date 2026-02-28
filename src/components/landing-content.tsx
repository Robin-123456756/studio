"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Users, Target, BarChart3, Trophy, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */
type StandingsRow = {
  teamId: string;
  name: string;
  logoUrl: string;
  PL: number;
  GD: number;
  Pts: number;
};

type LiveStats = {
  teamCount: number;
  playerCount: number;
  managerCount: number;
  matchdays: number;
  topScorer: { name: string; points: number } | null;
};

/* ------------------------------------------------------------------ */
/*  Animated counter                                                  */
/* ------------------------------------------------------------------ */
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const animated = useRef(false);

  useEffect(() => {
    if (value === 0 || animated.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          const duration = 1200;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.round(eased * value));
            if (progress < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);

  return (
    <span ref={ref}>
      {display}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                   */
/* ------------------------------------------------------------------ */
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-muted/60 ${className}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export function LandingContent() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [standings, setStandings] = useState<StandingsRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect logged-in users straight to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace("/dashboard");
      } else {
        setAuthChecked(true);
      }
    });
  }, [router]);

  useEffect(() => {
    async function fetchAll() {
      const base = window.location.origin;

      const [teamsRes, standingsRes, playersRes, leaderboardRes] =
        await Promise.allSettled([
          fetch(`${base}/api/teams`, { credentials: "same-origin" }),
          fetch(`${base}/api/standings`, { credentials: "same-origin" }),
          fetch(`${base}/api/players`, { credentials: "same-origin" }),
          fetch(`${base}/api/fantasy-leaderboard`, { credentials: "same-origin" }),
        ]);

      // Teams count
      let teamCount = 0;
      if (teamsRes.status === "fulfilled" && teamsRes.value.ok) {
        const d = await teamsRes.value.json();
        teamCount = d.teams?.length ?? 0;
      }

      // Players + top scorer
      let playerCount = 0;
      let topScorer: { name: string; points: number } | null = null;
      if (playersRes.status === "fulfilled" && playersRes.value.ok) {
        const d = await playersRes.value.json();
        const players = d.players ?? [];
        playerCount = players.length;
        if (players.length > 0) {
          const sorted = [...players].sort(
            (a: any, b: any) => (b.points ?? 0) - (a.points ?? 0)
          );
          if (sorted[0]?.points > 0) {
            topScorer = {
              name: sorted[0].name ?? sorted[0].webName ?? "Unknown",
              points: sorted[0].points,
            };
          }
        }
      }

      // Managers count
      let managerCount = 0;
      if (leaderboardRes.status === "fulfilled" && leaderboardRes.value.ok) {
        const d = await leaderboardRes.value.json();
        managerCount = d.leaderboard?.length ?? 0;
      }

      // Standings
      let standingsRows: StandingsRow[] = [];
      let matchdays = 0;
      if (standingsRes.status === "fulfilled" && standingsRes.value.ok) {
        const d = await standingsRes.value.json();
        standingsRows = (d.rows ?? []).slice(0, 8);
        // Matchdays = max PL across all teams
        matchdays = Math.max(0, ...((d.rows ?? []) as StandingsRow[]).map((r) => r.PL));
      }

      setStats({ teamCount, playerCount, managerCount, matchdays, topScorer });
      setStandings(standingsRows);
      setLoading(false);
    }

    fetchAll();
  }, []);

  // Show nothing while checking auth — prevents flash for logged-in users
  if (!authChecked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
        <img src="/icon.jpg" alt="The Budo League" className="h-[100px] w-auto object-contain" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* ============================================================ */}
      {/*  HERO                                                        */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden px-4 pt-12 pb-16 sm:pt-20 sm:pb-24 text-center">
        {/* Faded pitch backdrop */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.06]"
          style={{
            backgroundImage: "url(/pitch.svg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />

        <div className="relative z-10 mx-auto max-w-lg">
          <Image
            src="/icon.jpg"
            alt="The Budo League"
            width={80}
            height={80}
            className="mx-auto mb-6 rounded-2xl shadow-lg"
            priority
          />

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            THE BUDO LEAGUE
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground font-medium mb-2">
            Fantasy Football for Kampala&apos;s Finest
          </p>

          <p className="text-sm sm:text-base text-muted-foreground mb-8 max-w-md mx-auto leading-relaxed">
            Build your dream squad from real Budo League players. Set captains,
            make transfers, and compete with friends every gameweek.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
            >
              <Trophy className="h-4 w-4" />
              Start Playing
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold hover:bg-accent/50 transition-colors"
            >
              View League
            </Link>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  LIVE STATS STRIP                                            */}
      {/* ============================================================ */}
      <section className="px-4 pb-12">
        <div className="mx-auto max-w-lg">
          <div className="rounded-2xl bg-card/80 border border-border shadow-sm p-5">
            {loading ? (
              <div className="grid grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="text-center">
                    <Skeleton className="h-8 w-12 mx-auto mb-2" />
                    <Skeleton className="h-3 w-16 mx-auto" />
                  </div>
                ))}
              </div>
            ) : stats ? (
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-primary">
                    <AnimatedNumber value={stats.teamCount} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Teams</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-primary">
                    <AnimatedNumber value={stats.playerCount} suffix="+" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Players</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-primary">
                    <AnimatedNumber value={stats.managerCount} suffix="+" />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Managers</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-primary">
                    <AnimatedNumber value={stats.matchdays} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Matchdays</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  HOW IT WORKS                                                */}
      {/* ============================================================ */}
      <section className="px-4 pb-14">
        <div className="mx-auto max-w-lg">
          <h2 className="text-xl font-bold text-center mb-6">How It Works</h2>

          <div className="grid grid-cols-2 gap-3">
            {[
              {
                icon: Users,
                title: "Pick Your Squad",
                desc: "Choose 17 real Budo League players within your budget",
              },
              {
                icon: Target,
                title: "Set Formation",
                desc: "1 GK + 9 outfield starters, pick your captain",
              },
              {
                icon: BarChart3,
                title: "Earn Points",
                desc: "Real match stats turn into fantasy points every gameweek",
              },
              {
                icon: Trophy,
                title: "Climb the Board",
                desc: "Track your rank weekly and compete for bragging rights",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-border bg-card/60 p-4 text-center"
              >
                <step.icon className="h-7 w-7 mx-auto mb-2 text-primary" />
                <h3 className="text-sm font-semibold mb-1">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-snug">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  LIVE LEAGUE TABLE                                           */}
      {/* ============================================================ */}
      <section className="px-4 pb-14">
        <div className="mx-auto max-w-lg">
          <h2 className="text-xl font-bold text-center mb-6">
            Live League Standings
          </h2>

          <div className="rounded-2xl border border-border bg-card/80 overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : standings && standings.length > 0 ? (
              <>
                {/* Header */}
                <div className="grid grid-cols-[2rem_1fr_2.5rem_2.5rem_3rem] gap-1 px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                  <span>#</span>
                  <span>Team</span>
                  <span className="text-center">PL</span>
                  <span className="text-center">GD</span>
                  <span className="text-right">Pts</span>
                </div>

                {standings.map((row, i) => (
                  <div
                    key={row.teamId}
                    className="grid grid-cols-[2rem_1fr_2.5rem_2.5rem_3rem] gap-1 items-center px-4 py-2.5 text-sm border-b border-border/50 last:border-b-0"
                  >
                    {/* Position badge */}
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold text-white ${
                        i < 4
                          ? "bg-emerald-600"
                          : "bg-amber-500"
                      }`}
                    >
                      {i + 1}
                    </span>

                    {/* Team name */}
                    <span className="font-medium truncate">{row.name}</span>

                    {/* Played */}
                    <span className="text-center text-muted-foreground">
                      {row.PL}
                    </span>

                    {/* Goal difference */}
                    <span
                      className={`text-center font-medium ${
                        row.GD > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : row.GD < 0
                          ? "text-red-500"
                          : "text-muted-foreground"
                      }`}
                    >
                      {row.GD > 0 ? `+${row.GD}` : row.GD}
                    </span>

                    {/* Points */}
                    <span className="text-right font-bold">{row.Pts}</span>
                  </div>
                ))}

                {/* Footer link */}
                <Link
                  href="/dashboard"
                  className="flex items-center justify-center gap-1 py-3 text-xs font-semibold text-primary hover:bg-accent/30 transition-colors border-t border-border"
                >
                  View Full Standings
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No standings data yet &mdash; the season is about to begin!
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  FOOTER CTA                                                  */}
      {/* ============================================================ */}
      <section className="mt-auto px-4 py-12 text-center bg-gradient-to-t from-primary/5 to-transparent">
        <div className="mx-auto max-w-lg">
          <h2 className="text-xl font-bold mb-3">
            Ready to prove you know football?
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Join managers across Kampala competing in The Budo League Fantasy.
          </p>

          <div className="flex items-center justify-center gap-3 mb-8">
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-md hover:opacity-90 transition-opacity"
            >
              Create Account
            </Link>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-semibold hover:bg-accent/50 transition-colors"
            >
              Sign In
            </Link>
          </div>

          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} The Budo League
          </p>
        </div>
      </section>
    </div>
  );
}
