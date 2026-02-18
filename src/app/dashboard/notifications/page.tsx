"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Clock,
  Trophy,
  TrendingUp,
  Swords,
  AlertCircle,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Notification = {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  time: string;
  color: string;
  href?: string;
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);

        const [gwRes, upcomingRes, playedRes, standingsRes] = await Promise.all([
          fetch("/api/gameweeks/current", { cache: "no-store" }),
          fetch("/api/fixtures?played=0", { cache: "no-store" }),
          fetch("/api/fixtures?played=1", { cache: "no-store" }),
          fetch("/api/standings", { cache: "no-store" }),
        ]);

        const gwJson = await gwRes.json();
        const upcomingJson = await upcomingRes.json();
        const playedJson = await playedRes.json();
        const standingsJson = await standingsRes.json();

        // Fetch GW stats for summary (after we know the current GW)
        const recentGwId = gwJson.current?.id;
        let gwStatsData: any[] = [];
        if (recentGwId) {
          try {
            const statsRes = await fetch(`/api/player-stats?gw_id=${recentGwId}`, { cache: "no-store" });
            const statsJson = await statsRes.json();
            gwStatsData = statsJson.stats ?? [];
          } catch { /* silent */ }
        }

        if (cancelled) return;

        const items: Notification[] = [];
        const now = Date.now();

        // ── 1. Gameweek deadline ──
        const current = gwJson.current;
        const next = gwJson.next;

        if (current?.deadline_time) {
          const dl = new Date(current.deadline_time).getTime();
          const diffH = Math.round((dl - now) / (1000 * 60 * 60));
          const gwName = current.name || `Matchday ${current.id}`;

          if (diffH > 0 && diffH <= 48) {
            items.push({
              id: "deadline-current",
              icon: <Clock className="h-5 w-5" />,
              title: `${gwName} deadline in ${diffH}h`,
              body: "Make your transfers before the deadline locks.",
              time: formatRelative(dl),
              color: "text-amber-500",
              href: "/dashboard/transfers",
            });
          } else if (diffH <= 0 && diffH > -2) {
            items.push({
              id: "deadline-locked",
              icon: <AlertCircle className="h-5 w-5" />,
              title: `${gwName} deadline has passed`,
              body: "Transfers are now locked for this matchday.",
              time: formatRelative(dl),
              color: "text-red-500",
            });
          }
        }

        if (next?.deadline_time) {
          const dl = new Date(next.deadline_time).getTime();
          const diffH = Math.round((dl - now) / (1000 * 60 * 60));
          const gwName = next.name || `Matchday ${next.id}`;

          if (diffH > 0 && diffH <= 72) {
            items.push({
              id: "deadline-next",
              icon: <Clock className="h-5 w-5" />,
              title: `${gwName} deadline in ${diffH}h`,
              body: "Get your team ready for the next matchday.",
              time: formatRelative(dl),
              color: "text-amber-500",
              href: "/dashboard/transfers",
            });
          }
        }

        // ── 2. Upcoming matches ──
        const upcoming = (upcomingJson.fixtures ?? []).slice(0, 6);
        for (const f of upcoming) {
          const ko = f.kickoff_time ? new Date(f.kickoff_time).getTime() : null;
          const diffH = ko ? Math.round((ko - now) / (1000 * 60 * 60)) : null;
          const home = f.home_team?.short_name ?? "???";
          const away = f.away_team?.short_name ?? "???";
          const koStr = ko
            ? new Date(ko).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
            : "";

          let body = `${home} vs ${away}`;
          if (koStr) body += ` at ${koStr}`;

          if (diffH !== null && diffH >= 0 && diffH <= 48) {
            items.push({
              id: `upcoming-${f.id}`,
              icon: <CalendarDays className="h-5 w-5" />,
              title:
                diffH <= 24
                  ? `Match tomorrow${koStr ? ` at ${koStr}` : ""}`
                  : `Match in ${Math.ceil(diffH / 24)} days`,
              body,
              time: ko ? formatRelative(ko) : "",
              color: "text-blue-500",
              href: "/dashboard/fixtures",
            });
          }
        }

        // ── 3. Recent results ──
        const played = (playedJson.fixtures ?? []).slice(-4).reverse();
        for (const f of played) {
          const home = f.home_team?.short_name ?? "???";
          const away = f.away_team?.short_name ?? "???";
          const hg = f.home_goals ?? 0;
          const ag = f.away_goals ?? 0;
          const ko = f.kickoff_time ? new Date(f.kickoff_time).getTime() : now;

          items.push({
            id: `result-${f.id}`,
            icon: <Swords className="h-5 w-5" />,
            title: `${home} ${hg} - ${ag} ${away}`,
            body: f.gameweek?.name ? `${f.gameweek.name} — Full time` : "Full time",
            time: formatRelative(ko),
            color: "text-emerald-500",
            href: "/dashboard/matches?tab=results",
          });
        }

        // ── 4. Standings leader ──
        const rows = standingsJson.rows ?? [];
        if (rows.length > 0) {
          const leader = rows[0];
          items.push({
            id: "leader",
            icon: <Trophy className="h-5 w-5" />,
            title: `${leader.name} leads the league`,
            body: `${leader.Pts} pts — ${leader.W}W ${leader.D}D ${leader.L}L (GD ${leader.GD >= 0 ? "+" : ""}${leader.GD})`,
            time: "",
            color: "text-yellow-500",
            href: "/dashboard/matches?tab=table",
          });

          // Closest gap
          if (rows.length >= 2) {
            const gap = rows[0].Pts - rows[1].Pts;
            if (gap <= 3 && gap > 0) {
              items.push({
                id: "title-race",
                icon: <TrendingUp className="h-5 w-5" />,
                title: "Title race is heating up!",
                body: `Only ${gap} point${gap === 1 ? "" : "s"} between ${rows[0].name} and ${rows[1].name}.`,
                time: "",
                color: "text-orange-500",
                href: "/dashboard/matches?tab=table",
              });
            }
          }
        }

        // ── 5. GW Summary — top performer & top scorer ──
        if (gwStatsData.length > 0 && recentGwId) {
          const sorted = [...gwStatsData].sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0));
          const topPerformer = sorted[0];
          const gwLabel = gwJson.current?.name || `GW${recentGwId}`;

          if (topPerformer && topPerformer.points > 0) {
            items.push({
              id: "gw-top-performer",
              icon: <Star className="h-5 w-5" />,
              title: `${gwLabel} Top Performer: ${topPerformer.playerName}`,
              body: `${topPerformer.points} pts — ${topPerformer.goals ?? 0}G ${topPerformer.assists ?? 0}A`,
              time: "",
              color: "text-purple-500",
              href: `/dashboard/players/${topPerformer.playerId}`,
            });
          }

          // Top goal scorer (if different from top performer)
          const goalScorers = gwStatsData
            .filter((s: any) => (s.goals ?? 0) > 0)
            .sort((a: any, b: any) => (b.goals ?? 0) - (a.goals ?? 0));

          if (goalScorers.length > 0 && goalScorers[0].playerId !== topPerformer?.playerId) {
            const top = goalScorers[0];
            items.push({
              id: "gw-top-goals",
              icon: <TrendingUp className="h-5 w-5" />,
              title: `${gwLabel} Top Scorer: ${top.playerName}`,
              body: `${top.goals} goal${top.goals > 1 ? "s" : ""}`,
              time: "",
              color: "text-emerald-500",
              href: `/dashboard/players/${top.playerId}`,
            });
          }
        }

        setNotifications(items);
      } catch (e) {
        console.error("Notifications error:", e);
        setNotifications([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28 space-y-4 animate-in fade-in-50">
      <h1 className="text-2xl font-extrabold tracking-tight">Notifications</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-center space-y-2">
            <div className="text-3xl">🔔</div>
            <p className="text-sm font-semibold">You're all caught up!</p>
            <p className="text-xs text-muted-foreground">
              Notifications about matches, deadlines and results will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const inner = (
              <Card
                className={cn(
                  "rounded-2xl transition-all",
                  n.href && "hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
                )}
              >
                <CardContent className="flex items-start gap-3 p-4">
                  <div className={cn("mt-0.5 shrink-0", n.color)}>{n.icon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                  </div>
                  {n.time ? (
                    <span className="shrink-0 text-[11px] text-muted-foreground/70 mt-0.5">
                      {n.time}
                    </span>
                  ) : null}
                </CardContent>
              </Card>
            );

            return n.href ? (
              <Link key={n.id} href={n.href} className="block">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const abs = Math.abs(diff);
  const future = diff < 0;

  if (abs < 60_000) return "just now";
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000);
    return future ? `in ${m}m` : `${m}m ago`;
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000);
    return future ? `in ${h}h` : `${h}h ago`;
  }
  const d = Math.round(abs / 86_400_000);
  return future ? `in ${d}d` : `${d}d ago`;
}
