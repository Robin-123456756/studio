"use client";

import * as React from "react";
import { AppLoading } from "@/components/app-loading";

type LaunchGateProps = {
  children: React.ReactNode;
  minDurationMs?: number;
  message?: string;
};

export function LaunchGate({
  children,
  minDurationMs = 8000,
  message = "Loading your season...",
}: LaunchGateProps) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (!isStandalone) {
      setReady(true);
      return;
    }

    const timer = window.setTimeout(() => {
      setReady(true);
    }, minDurationMs);

    return () => window.clearTimeout(timer);
  }, [minDurationMs]);

  const readyClass = ready ? "is-ready" : "";

  return (
    <div className="launch-gate">
      <div className={`launch-loader ${readyClass}`}>
        <AppLoading message={message} />
      </div>
      <div className={`launch-content ${readyClass}`}>{children}</div>
    </div>
  );
}
