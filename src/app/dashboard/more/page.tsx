"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";

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

/* ── Sections (FPL-style grouping) ── */

function useSections(gwLabel: string | null): MenuSection[] {
  return React.useMemo(
    () => [
      {
        title: "The League",
        items: [
          { href: "/dashboard/teams", label: "Teams" },
          { href: "/dashboard/players", label: "Player Statistics" },
          { href: "/dashboard/matches?tab=results", label: "Results", subtitle: gwLabel ?? undefined },
          { href: "/dashboard/fixtures", label: "Fixtures" },
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
      {
        title: "Account",
        items: [
          { href: "/dashboard/settings", label: "Settings" },
          { href: "/dashboard/notifications", label: "Notifications" },
        ],
      },
    ],
    [gwLabel]
  );
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

/* ── Section List Item ── */

function SectionItem({ item }: { item: MenuItem }) {
  const { href, label, subtitle } = item;
  return (
    <Link
      href={href}
      className="flex items-center justify-between py-3.5 px-4 active:bg-accent/30 transition-colors"
    >
      <div className="min-w-0">
        <span className="text-sm font-semibold">{label}</span>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
              "flex w-full items-center gap-3 py-3.5 px-3 transition-colors active:bg-accent/30",
              "text-red-500",
              loggingOut && "opacity-50 pointer-events-none"
            )}
          >
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
