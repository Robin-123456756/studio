"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";

type Mode = "light" | "dark" | "system";

function ThemeRow() {
  const { theme, setTheme, systemTheme } = useTheme();
  const current = (theme ?? "system") as Mode;

  const Btn = ({ value, label }: { value: Mode; label: string }) => {
    const active = current === value;
    return (
      <button
        type="button"
        onClick={() => setTheme(value)}
        className={cn(
          "px-3 py-2 rounded-xl text-sm font-semibold transition",
          active ? "bg-background shadow border" : "text-muted-foreground hover:bg-accent/20"
        )}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="py-4 border-b border-border/60">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold">Appearance</div>
          <div className="text-sm text-muted-foreground">
            {current === "system"
              ? `System (${systemTheme ?? "..."})`
              : current === "dark"
              ? "Dark"
              : "Light"}
          </div>
        </div>

        <div className="rounded-2xl bg-muted p-1 inline-flex shrink-0">
          <Btn value="light" label="Light" />
          <Btn value="dark" label="Dark" />
          <Btn value="system" label="System" />
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28">
      {/* EPL-like header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/more"
          className="h-10 w-10 rounded-full grid place-items-center hover:bg-accent/20 active:bg-accent/30"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">myTBL Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Personalise your experience</p>
        </div>
      </div>

      <div className="mt-4">
        <ThemeRow />
        <PushNotificationToggle />
      </div>
    </div>
  );
}
