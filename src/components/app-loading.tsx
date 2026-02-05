"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function AppLoading({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="mb-8 animate-in fade-in zoom-in-95 duration-500">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-border">
            <img
              src="/icon.png"
              alt="Budo League"
              className="h-20 w-20 object-contain"
            />
          </div>
          <div className="absolute inset-0 rounded-3xl bg-primary/20 animate-pulse" />
        </div>
      </div>

      <h1 className="mb-2 text-2xl font-bold animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
        The Budo League
      </h1>

      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "h-2 w-2 rounded-full bg-primary",
                i === 0 && "animate-bounce",
                i === 1 && "animate-bounce [animation-delay:0.1s]",
                i === 2 && "animate-bounce [animation-delay:0.2s]"
              )}
            />
          ))}
        </div>
        <span className="text-sm text-muted-foreground">{message}</span>
      </div>

      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full w-1/3 rounded-full"
          style={{
            animation: "shimmer 1.5s ease-in-out infinite",
            background:
              "linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)",
            backgroundSize: "200% 100%",
          }}
        />
      </div>
    </div>
  );
}
