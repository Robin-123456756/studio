"use client";

import * as React from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, User, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { Skeleton } from "@/components/ui/skeleton";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

/* ── Appearance radio rows ── */

type ThemeOption = { value: string; label: string };

const themeOptions: ThemeOption[] = [
  { value: "light", label: "Light" },
  { value: "gold", label: "Gold" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System default" },
];

function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const current = theme ?? "system";

  return (
    <div className="mt-6">
      <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Appearance
      </h2>
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/40">
        {themeOptions.map((opt) => {
          const active = mounted && current === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className="flex w-full items-center justify-between py-3.5 px-4 active:bg-accent/30 transition-colors"
            >
              <span className="text-sm font-semibold">{opt.label}</span>
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors",
                  active
                    ? "border-primary"
                    : "border-muted-foreground/40"
                )}
              >
                {active && (
                  <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Page ── */

export default function SettingsPage() {
  const [teamName, setTeamName] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.user) {
          if (!cancelled) setLoading(false);
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

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/dashboard/more"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-card border border-border/60 active:bg-accent/30 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">MyTBL Settings</h1>
      </div>

      {/* My Account */}
      <div>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          My Account
        </h2>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card divide-y divide-border/40">
          {/* Team Name */}
          <div className="flex items-center gap-3 py-3 px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Team Name</p>
              {loading ? (
                <Skeleton className="h-4 w-28 mt-0.5" />
              ) : (
                <p className="text-sm font-semibold truncate">{teamName ?? "My Team"}</p>
              )}
            </div>
          </div>

          {/* Email */}
          <div className="flex items-center gap-3 py-3 px-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Mail className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              {loading ? (
                <Skeleton className="h-4 w-40 mt-0.5" />
              ) : (
                <p className="text-sm font-semibold truncate">{email}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="mt-6">
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notifications
        </h2>
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="px-4">
            <PushNotificationToggle />
          </div>
        </div>
      </div>

      {/* Appearance */}
      <AppearanceSection />
    </div>
  );
}
