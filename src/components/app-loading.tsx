"use client";

import * as React from "react";

export function AppLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Logo — no ring, no background */}
      <div className="mb-6 animate-in fade-in zoom-in-90 duration-700 ease-out">
        <img
          src="/tbl-logo.png"
          alt="The Budo League"
          className="h-auto w-[180px] object-contain dark:brightness-0 dark:invert"
        />
      </div>

      {/* Tagline */}
      <p className="mt-1.5 text-xs font-medium text-muted-foreground tracking-wide animate-in fade-in duration-700 fill-mode-both delay-300">
        Fantasy Football
      </p>

      {/* Progress sweep */}
      <div className="mt-8 h-[2px] w-44 overflow-hidden rounded-full bg-border/50 animate-in fade-in duration-500 fill-mode-both delay-500">
        <div
          className="absolute inset-y-0 w-2/5 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.8), transparent)",
            animation: "sweep 1.6s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}
