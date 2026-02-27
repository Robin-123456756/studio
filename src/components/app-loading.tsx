"use client";

import * as React from "react";

export function AppLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {/* Subtle branded radial glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(600px circle at 50% 45%, hsl(var(--primary) / 0.07), transparent 70%)",
        }}
      />

      {/* Logo */}
      <div className="relative z-10 mb-6 animate-in fade-in zoom-in-90 duration-700 ease-out">
        <div className="flex h-[104px] w-[104px] items-center justify-center overflow-hidden rounded-[1.75rem] bg-card shadow-xl ring-1 ring-border/60">
          <img
            src="/icon.png"
            alt="Budo League"
            className="h-[88px] w-[88px] object-contain"
          />
        </div>
      </div>

      {/* Brand name */}
      <h1 className="relative z-10 text-[1.35rem] font-bold tracking-[0.12em] uppercase animate-in fade-in slide-in-from-bottom-2 duration-700 fill-mode-both delay-200">
        THE BUDO LEAGUE
      </h1>

      {/* Tagline */}
      <p className="relative z-10 mt-1.5 text-xs font-medium text-muted-foreground tracking-wide animate-in fade-in duration-700 fill-mode-both delay-500">
        Fantasy Football
      </p>

      {/* Progress sweep */}
      <div className="relative z-10 mt-8 h-[2px] w-44 overflow-hidden rounded-full bg-border/50 animate-in fade-in duration-500 fill-mode-both delay-700">
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
