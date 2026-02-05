"use client";

import * as React from "react";
import { AppLoading } from "@/components/app-loading";

type Phase = "splash" | "loading" | "app";

const SPLASH_MS = 1100;
const LOADING_MS = 1600;

export default function LaunchDemoPage() {
  const [phase, setPhase] = React.useState<Phase>("splash");
  const [runKey, setRunKey] = React.useState(0);

  React.useEffect(() => {
    setPhase("splash");
    const splashTimer = window.setTimeout(() => {
      setPhase("loading");
    }, SPLASH_MS);
    const loadingTimer = window.setTimeout(() => {
      setPhase("app");
    }, SPLASH_MS + LOADING_MS);

    return () => {
      window.clearTimeout(splashTimer);
      window.clearTimeout(loadingTimer);
    };
  }, [runKey]);

  if (phase === "splash") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
        <div className="animate-in fade-in zoom-in-95 duration-500">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-border">
            <img
              src="/icon.png"
              alt="Budo League"
              className="h-20 w-20 object-contain"
            />
          </div>
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Opening The Budo League
        </div>
      </div>
    );
  }

  if (phase === "loading") {
    return <AppLoading message="Loading your season..." />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-app flex-col gap-6 px-4 pb-10 pt-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Launch flow complete
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRunKey((value) => value + 1)}
            className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            Replay launch
          </button>
        </div>

        <div className="grid gap-4">
          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="text-sm text-muted-foreground">
              Upcoming fixture
            </div>
            <div className="mt-2 text-lg font-semibold">
              Centurions vs Night Prep
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              Saturday, 6:30 PM
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
            <div className="text-sm text-muted-foreground">
              Fantasy summary
            </div>
            <div className="mt-2 text-lg font-semibold">Season rank #42</div>
            <div className="mt-1 text-sm text-muted-foreground">
              18 points behind the leader
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
