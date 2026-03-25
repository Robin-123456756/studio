"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  User,
  LogOut,
  Clock,
  CalendarDays,
  Trophy,
  Swords,
  AlertCircle,
  Star,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeSettingRow } from "@/components/theme-setting";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

/* ── Types ── */

type MenuItem = {
  href: string;
  label: string;
  subtitle?: string;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

type ProfileData = {
  teamName: string;
  email: string;
  totalPoints: number | null;
  rank: number | null;
};

type NotificationItem = {
  id: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  time: string;
  color: string;
  href?: string;
};

/* ── Sections (FPL-style grouping) — removed Account, now inline ── */

function useSections(gwLabel: string | null): MenuSection[] {
  return React.useMemo(
    () => [
      {
        title: "The League",
        items: [
          { href: "/dashboard/teams", label: "Teams" },
          { href: "/dashboard/players", label: "Player Statistics" },
          { href: "/dashboard/matches?tab=results", label: "Results", subtitle: gwLabel ?? undefined },
          { href: "/dashboard/matches", label: "Fixtures" },
        ],
      },
      {
        title: "Fantasy",
        items: [
          { href: "/dashboard/fantasy/dream-team", label: "Dream Team" },
          { href: "/dashboard/transfers", label: "Transfers" },
          { href: "/dashboard/fantasy/leagues", label: "Leagues & Cups" },
          { href: "/dashboard/fantasy/cup", label: "Budo Cup" },
        ],
      },
      {
        title: "Help & Info",
        items: [
          { href: "/dashboard/more/tbl-rules", label: "TBL Fantasy Rules" },
          { href: "/dashboard/reviews", label: "Feedback" },
        ],
      },
    ],
    [gwLabel]
  );
}

/* ── Notification helpers (reused from notifications page) ── */

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

function useNotifications() {
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
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

        const result: NotificationItem[] = [];
        const now = Date.now();

        // Deadline
        const current = gwJson.current;
        const next = gwJson.next;

        if (current?.deadline_time) {
          const dl = new Date(current.deadline_time).getTime();
          const diffH = Math.round((dl - now) / (1000 * 60 * 60));
          const gwName = current.name || `Matchday ${current.id}`;
          if (diffH > 0 && diffH <= 48) {
            result.push({
              id: "deadline-current",
              icon: <Clock className="h-4 w-4" />,
              title: `${gwName} deadline in ${diffH}h`,
              body: "Make your transfers before the deadline locks.",
              time: formatRelative(dl),
              color: "text-amber-500",
              href: "/dashboard/transfers",
            });
          } else if (diffH <= 0 && diffH > -2) {
            result.push({
              id: "deadline-locked",
              icon: <AlertCircle className="h-4 w-4" />,
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
            result.push({
              id: "deadline-next",
              icon: <Clock className="h-4 w-4" />,
              title: `${gwName} deadline in ${diffH}h`,
              body: "Get your team ready for the next matchday.",
              time: formatRelative(dl),
              color: "text-amber-500",
              href: "/dashboard/transfers",
            });
          }
        }

        // Upcoming matches (max 3 for preview)
        const upcoming = (upcomingJson.fixtures ?? []).slice(0, 3);
        for (const f of upcoming) {
          const ko = f.kickoff_time ? new Date(f.kickoff_time).getTime() : null;
          const diffH = ko ? Math.round((ko - now) / (1000 * 60 * 60)) : null;
          const home = f.home_team?.short_name ?? "???";
          const away = f.away_team?.short_name ?? "???";

          if (diffH !== null && diffH >= 0 && diffH <= 48) {
            result.push({
              id: `upcoming-${f.id}`,
              icon: <CalendarDays className="h-4 w-4" />,
              title: `${home} vs ${away}`,
              body: diffH <= 24 ? "Tomorrow" : `In ${Math.ceil(diffH / 24)} days`,
              time: ko ? formatRelative(ko) : "",
              color: "text-blue-500",
              href: "/dashboard/matches",
            });
          }
        }

        // Recent results (max 2 for preview)
        const played = (playedJson.fixtures ?? []).slice(-2).reverse();
        for (const f of played) {
          const home = f.home_team?.short_name ?? "???";
          const away = f.away_team?.short_name ?? "???";
          const hg = f.home_goals ?? 0;
          const ag = f.away_goals ?? 0;
          const ko = f.kickoff_time ? new Date(f.kickoff_time).getTime() : now;

          result.push({
            id: `result-${f.id}`,
            icon: <Swords className="h-4 w-4" />,
            title: `${home} ${hg} - ${ag} ${away}`,
            body: "Full time",
            time: formatRelative(ko),
            color: "text-emerald-500",
            href: "/dashboard/matches?tab=results",
          });
        }

        // League leader
        const rows = standingsJson.rows ?? [];
        if (rows.length > 0) {
          const leader = rows[0];
          result.push({
            id: "leader",
            icon: <Trophy className="h-4 w-4" />,
            title: `${leader.name} leads the league`,
            body: `${leader.Pts} pts`,
            time: "",
            color: "text-yellow-500",
            href: "/dashboard/matches?tab=table",
          });
        }

        // GW top performer
        if (gwStatsData.length > 0 && recentGwId) {
          const sorted = [...gwStatsData].sort((a: any, b: any) => (b.points ?? 0) - (a.points ?? 0));
          const topPerformer = sorted[0];
          if (topPerformer && topPerformer.points > 0) {
            result.push({
              id: "gw-top-performer",
              icon: <Star className="h-4 w-4" />,
              title: `Top: ${topPerformer.playerName}`,
              body: `${topPerformer.points} pts — ${topPerformer.goals ?? 0}G ${topPerformer.assists ?? 0}A`,
              time: "",
              color: "text-purple-500",
              href: `/dashboard/players/${topPerformer.playerId}`,
            });
          }
        }

        setItems(result);
      } catch {
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return { items, loading };
}

/* ── Profile Card ── */

function ProfileCard({ profile, loading }: { profile: ProfileData | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl bg-card border border-border/60 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="rounded-xl bg-card border border-border/60 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold truncate">{profile.teamName}</p>
          <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
        </div>
      </div>

      {/* Points & Rank row */}
      {(profile.totalPoints !== null || profile.rank !== null) && (
        <div className="mt-3 flex gap-4 border-t border-border/40 pt-3">
          {profile.totalPoints !== null && (
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Total Points</p>
              <p className="text-lg font-bold">{profile.totalPoints}</p>
            </div>
          )}
          {profile.rank !== null && (
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Overall Rank</p>
              <p className="text-lg font-bold">{profile.rank}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Inline Notifications Preview ── */

function NotificationsPreview({
  items,
  loading,
}: {
  items: NotificationItem[];
  loading: boolean;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const preview = items.slice(0, 3);
  const hasMore = items.length > 3;

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span className="text-sm">You&apos;re all caught up!</span>
        </div>
      </div>
    );
  }

  const visible = expanded ? items : preview;

  return (
    <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 active:bg-accent/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" aria-hidden="true" />
          <span className="text-sm font-semibold">
            {items.length} notification{items.length !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            expanded && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {/* Notification items */}
      <div className="divide-y divide-border/40">
        {visible.map((n) => {
          const inner = (
            <div className="flex items-start gap-3 px-4 py-2.5">
              <div className={cn("mt-0.5 shrink-0", n.color)}>{n.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-snug">{n.title}</p>
                <p className="text-[11px] text-muted-foreground">{n.body}</p>
              </div>
              {n.time && (
                <span className="shrink-0 text-[10px] text-muted-foreground/70 mt-0.5">
                  {n.time}
                </span>
              )}
            </div>
          );

          return n.href ? (
            <Link
              key={n.id}
              href={n.href}
              className="block active:bg-accent/30 transition-colors"
            >
              {inner}
            </Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}
      </div>

      {/* See all link */}
      {hasMore && (
        <Link
          href="/dashboard/notifications"
          className="flex items-center justify-center gap-1 border-t border-border/40 px-4 py-2.5 text-xs font-semibold text-primary active:bg-accent/30 transition-colors"
        >
          See all notifications
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/* ── Section List Item ── */

function SectionItem({ item }: { item: MenuItem }) {
  const { href, label, subtitle } = item;
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-3.5 px-4 active:bg-accent/30 transition-colors"
    >
      <div className="min-w-0">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

/* ── Page ── */

export default function MorePage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [gwLabel, setGwLabel] = React.useState<string | null>(null);
  const [profile, setProfile] = React.useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);

  const sections = useSections(gwLabel);
  const { items: notifications, loading: notifLoading } = useNotifications();

  React.useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Fetch gameweek label
      try {
        const res = await fetch("/api/gameweeks/current", { credentials: "same-origin", cache: "no-store" });
        const json = await res.json();
        const gw = json.current;
        if (!cancelled && gw) {
          setGwLabel(gw.name || `Matchday ${gw.id}`);
        }
      } catch {}

      // Fetch profile: team name, email, rank & points from leaderboard
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (!cancelled) setProfileLoading(false);
          return;
        }

        const userId = session.user.id;
        const email = session.user.email ?? "";

        // Team name
        const { data: teamRow } = await supabase
          .from("fantasy_teams")
          .select("name")
          .eq("user_id", userId)
          .maybeSingle();

        const teamName =
          teamRow?.name && teamRow.name !== "My Team"
            ? teamRow.name
            : "My Team";

        // Overall rank & points from leaderboard API
        let totalPoints: number | null = null;
        let rank: number | null = null;
        try {
          const lbRes = await fetch("/api/fantasy-leaderboard", { credentials: "same-origin" });
          if (lbRes.ok) {
            const lbData = await lbRes.json();
            const entries = lbData.leaderboard ?? lbData;
            if (Array.isArray(entries)) {
              const me = entries.find(
                (e: { userId?: string }) => e.userId === userId
              );
              if (me) {
                totalPoints = me.totalPoints ?? null;
                rank = me.rank ?? null;
              }
            }
          }
        } catch {}

        if (!cancelled) {
          setProfile({ teamName, email, totalPoints, rank });
        }
      } catch {}

      if (!cancelled) setProfileLoading(false);
    }

    loadData();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28">
      {/* Title */}
      <h1 className="text-2xl font-extrabold tracking-tight">More</h1>

      {/* Profile Card */}
      <div className="mt-4">
        <ProfileCard profile={profile} loading={profileLoading} />
      </div>

      {/* Inline Notifications Preview */}
      <div className="mt-6">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notifications
        </h2>
        <NotificationsPreview items={notifications} loading={notifLoading} />
      </div>

      {/* Grouped Sections */}
      {sections.map((section) => (
        <div key={section.title} className="mt-6">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </h2>
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/40">
            {section.items.map((item) => (
              <SectionItem key={item.href} item={item} />
            ))}
          </div>
        </div>
      ))}

      {/* Inline Settings — no separate page needed */}
      <div className="mt-6">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Settings
        </h2>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="px-4">
            <ThemeSettingRow />
          </div>
          <div className="border-t border-border/40">
            <PushNotificationToggle />
          </div>
        </div>
      </div>

      {/* Log Out */}
      <div className="mt-6">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <button
            type="button"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              await supabase.auth.signOut();
              router.replace("/");
            }}
            className={cn(
              "flex w-full items-center gap-3 py-3.5 px-4 transition-colors active:bg-accent/30",
              "text-red-500",
              loggingOut && "opacity-50 pointer-events-none"
            )}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm font-semibold">
              {loggingOut ? "Logging out..." : "Log Out"}
            </span>
          </button>
        </div>
      </div>

      {/* App Version */}
      <p className="mt-6 text-center text-xs text-muted-foreground/60">
        The Budo League v1.0
      </p>
    </div>
  );
}
