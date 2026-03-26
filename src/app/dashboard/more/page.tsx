"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  User,
  LogOut,
  Bell,
  Users,
  BarChart3,
  Trophy,
  CalendarDays,
  Swords,
  Star,
  ArrowLeftRight,
  Award,
  BookOpen,
  MessageSquare,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";

/* ── Types ── */

type MenuItem = {
  href: string;
  label: string;
  subtitle?: string;
  icon: React.ReactNode;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

/* ── Sections with icons (FPL-style) ── */

function useSections(gwLabel: string | null): MenuSection[] {
  return React.useMemo(
    () => [
      {
        title: "The League",
        items: [
          { href: "/dashboard/teams", label: "Teams", icon: <Users className="h-5 w-5" /> },
          { href: "/dashboard/players", label: "Player Statistics", icon: <BarChart3 className="h-5 w-5" /> },
          { href: "/dashboard/matches?tab=results", label: "Results", subtitle: gwLabel ?? undefined, icon: <Swords className="h-5 w-5" /> },
          { href: "/dashboard/matches", label: "Fixtures", icon: <CalendarDays className="h-5 w-5" /> },
        ],
      },
      {
        title: "Fantasy",
        items: [
          { href: "/dashboard/fantasy/dream-team", label: "Dream Team", icon: <Star className="h-5 w-5" /> },
          { href: "/dashboard/transfers", label: "Transfers", icon: <ArrowLeftRight className="h-5 w-5" /> },
          { href: "/dashboard/fantasy/leagues", label: "Leagues & Cups", icon: <Trophy className="h-5 w-5" /> },
          { href: "/dashboard/fantasy/cup", label: "Budo Cup", icon: <Award className="h-5 w-5" /> },
        ],
      },
      {
        title: "Help & Info",
        items: [
          { href: "/dashboard/more/tbl-rules", label: "TBL Fantasy Rules", icon: <BookOpen className="h-5 w-5" /> },
          { href: "/dashboard/reviews", label: "Feedback", icon: <MessageSquare className="h-5 w-5" /> },
        ],
      },
    ],
    [gwLabel]
  );
}

/* ── Count notifications (mirrors notifications page logic) ── */

function countNotifications(
  gwJson: Record<string, any>,
  upcomingJson: Record<string, any>,
  playedJson: Record<string, any>,
  standingsJson: Record<string, any>,
  gwStatsData: any[],
): number {
  let n = 0;
  const now = Date.now();

  // 1. Deadlines
  const current = gwJson.current;
  const next = gwJson.next;
  if (current?.deadline_time) {
    const diffH = Math.round((new Date(current.deadline_time).getTime() - now) / 3_600_000);
    if (diffH > 0 && diffH <= 48) n++;
    else if (diffH <= 0 && diffH > -2) n++;
  }
  if (next?.deadline_time) {
    const diffH = Math.round((new Date(next.deadline_time).getTime() - now) / 3_600_000);
    if (diffH > 0 && diffH <= 72) n++;
  }

  // 2. Upcoming matches within 48h (max 6, same as notifications page)
  const upcoming = (upcomingJson.fixtures ?? []).slice(0, 6);
  for (const f of upcoming) {
    if (f.kickoff_time) {
      const diffH = Math.round((new Date(f.kickoff_time).getTime() - now) / 3_600_000);
      if (diffH >= 0 && diffH <= 48) n++;
    }
  }

  // 3. Recent results (max 4)
  const played = (playedJson.fixtures ?? []).slice(-4);
  n += played.length;

  // 4. Standings leader + title race
  const rows = standingsJson.rows ?? [];
  if (rows.length > 0) {
    n++; // leader
    if (rows.length >= 2) {
      const gap = rows[0].Pts - rows[1].Pts;
      if (gap <= 3 && gap > 0) n++; // title race
    }
  }

  // 5. GW top performer + top goal scorer (if different)
  if (gwStatsData.length > 0) {
    const top = gwStatsData.reduce((a: any, b: any) => ((b.points ?? 0) > (a.points ?? 0) ? b : a), gwStatsData[0]);
    if (top && top.points > 0) n++;

    const goalScorers = gwStatsData
      .filter((s: any) => (s.goals ?? 0) > 0)
      .sort((a: any, b: any) => (b.goals ?? 0) - (a.goals ?? 0));
    if (goalScorers.length > 0 && goalScorers[0].playerId !== top?.playerId) n++;
  }

  return n;
}

/* ── Row component (iOS Settings style) ── */

function MenuRow({
  href,
  icon,
  label,
  subtitle,
  trailing,
  onClick,
  className: extraClass,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  const inner = (
    <>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      {trailing !== undefined ? trailing : (
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
      )}
    </>
  );

  const baseClass = cn(
    "flex items-center gap-3 py-3 px-4 active:bg-accent/30 transition-colors",
    extraClass
  );

  if (href) {
    return (
      <Link href={href} className={baseClass}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={cn(baseClass, "w-full text-left")}>
      {inner}
    </button>
  );
}

/* ── Page ── */

export default function MorePage() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [gwLabel, setGwLabel] = React.useState<string | null>(null);
  const [notifCount, setNotifCount] = React.useState(0);
  const [teamName, setTeamName] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);

  const sections = useSections(gwLabel);

  React.useEffect(() => {
    let cancelled = false;

    async function loadData() {
      // Fetch gameweek, fixtures, standings in parallel (one pass for gwLabel + notif count)
      try {
        const [gwRes, upcomingRes, playedRes, standingsRes] = await Promise.all([
          fetch("/api/gameweeks/current", { credentials: "same-origin", cache: "no-store" }),
          fetch("/api/fixtures?played=0", { credentials: "same-origin", cache: "no-store" }),
          fetch("/api/fixtures?played=1", { credentials: "same-origin", cache: "no-store" }),
          fetch("/api/standings", { credentials: "same-origin", cache: "no-store" }),
        ]);

        if (cancelled) return;

        const gwJson = gwRes.ok ? await gwRes.json() : {};
        const upcomingJson = upcomingRes.ok ? await upcomingRes.json() : { fixtures: [] };
        const playedJson = playedRes.ok ? await playedRes.json() : { fixtures: [] };
        const standingsJson = standingsRes.ok ? await standingsRes.json() : { rows: [] };

        // Set gameweek label
        const gw = gwJson.current;
        if (gw) setGwLabel(gw.name || `Matchday ${gw.id}`);

        // Fetch GW stats for top performer count (mirrors notifications page)
        let gwStatsData: any[] = [];
        const recentGwId = gwJson.current?.id;
        if (recentGwId) {
          try {
            const statsRes = await fetch(`/api/player-stats?gw_id=${recentGwId}`, { credentials: "same-origin", cache: "no-store" });
            if (statsRes.ok) {
              const statsJson = await statsRes.json();
              gwStatsData = statsJson.stats ?? [];
            }
          } catch {}
        }

        if (!cancelled) {
          setNotifCount(countNotifications(gwJson, upcomingJson, playedJson, standingsJson, gwStatsData));
        }
      } catch {}

      // Fetch profile: team name + email only
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (!cancelled) setProfileLoading(false);
          return;
        }

        const userEmail = session.user.email ?? "";

        const { data: teamRow } = await supabase
          .from("fantasy_teams")
          .select("name")
          .eq("user_id", session.user.id)
          .maybeSingle();

        const name =
          teamRow?.name && teamRow.name !== "My Team"
            ? teamRow.name
            : "My Team";

        if (!cancelled) {
          setTeamName(name);
          setEmail(userEmail);
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

      {/* Profile row */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-card">
        {profileLoading ? (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="h-9 w-9 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{teamName ?? "My Team"}</p>
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
          </div>
        )}
      </div>

      {/* Notifications row */}
      <div className="mt-3 overflow-hidden rounded-xl border border-border/60 bg-card">
        <MenuRow
          href="/dashboard/notifications"
          icon={<Bell className="h-5 w-5" />}
          label="Notifications"
          trailing={
            <div className="flex items-center gap-2">
              {notifCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                  {notifCount}
                </span>
              )}
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </div>
          }
        />
      </div>

      {/* Grouped Sections */}
      {sections.map((section) => (
        <div key={section.title} className="mt-6">
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </h2>
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/40">
            {section.items.map((item) => (
              <MenuRow
                key={item.href}
                href={item.href}
                icon={item.icon}
                label={item.label}
                subtitle={item.subtitle}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Settings */}
      <div className="mt-6">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Settings
        </h2>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <MenuRow
            href="/dashboard/more/settings"
            icon={<Settings className="h-5 w-5" />}
            label="MyTBL Settings"
          />
        </div>
      </div>

      {/* Log Out */}
      <div className="mt-6">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <MenuRow
            icon={<LogOut className="h-5 w-5" />}
            label={loggingOut ? "Logging out..." : "Log Out"}
            onClick={async () => {
              setLoggingOut(true);
              await supabase.auth.signOut();
              router.replace("/");
            }}
            trailing={null}
            className={cn(
              "text-red-500 [&_div:first-child]:bg-red-500/10 [&_div:first-child]:text-red-500 [&_span]:text-red-500",
              loggingOut && "opacity-50 pointer-events-none"
            )}
          />
        </div>
      </div>

      {/* App Version */}
      <p className="mt-6 text-center text-xs text-muted-foreground/60">
        The Budo League v1.0
      </p>
    </div>
  );
}
