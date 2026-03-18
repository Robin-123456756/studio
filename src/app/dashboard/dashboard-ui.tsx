"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function posBarClass(pos: number) {
  if (pos >= 1 && pos <= 4) return "bg-emerald-500";
  if (pos >= 5 && pos <= 8) return "bg-amber-500";
  return "bg-transparent";
}

export function formatShortDate(iso: string | null) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatKickoff(iso: string | null) {
  if (!iso) return "--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Africa/Kampala",
  })
    .format(d)
    .replace(/\bam\b/i, "AM")
    .replace(/\bpm\b/i, "PM");
}

export function timeAgo(iso: string) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const CATEGORY_STYLES: Record<string, string> = {
  announcement: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  matchday: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  player_spotlight: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  deadline: "bg-red-500/15 text-red-600 dark:text-red-400",
  general: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  result: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  transfer: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  leader: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

export function CategoryPill({ category }: { category: string }) {
  const label = category.replace("_", " ");
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        CATEGORY_STYLES[category] ?? CATEGORY_STYLES.general
      )}
    >
      {label}
    </span>
  );
}

function formatCountdown(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

export function useDeadlineCountdown(deadlineIso?: string | null) {
  const [now, setNow] = React.useState(Date.now());

  React.useEffect(() => {
    if (!deadlineIso) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadlineIso]);

  if (!deadlineIso) {
    return { label: "TBA", msLeft: null, tone: "neutral" as const };
  }

  const msLeft = new Date(deadlineIso).getTime() - now;
  if (Number.isNaN(msLeft)) {
    return { label: "TBA", msLeft: null, tone: "neutral" as const };
  }

  if (msLeft <= 0) {
    return { label: "Closed", msLeft: 0, tone: "closed" as const };
  }

  const hoursLeft = msLeft / 3600000;
  const tone: "critical" | "urgent" | "soon" | "normal" =
    hoursLeft <= 1 ? "critical" : hoursLeft <= 6 ? "urgent" : hoursLeft <= 24 ? "soon" : "normal";

  return { label: formatCountdown(msLeft), msLeft, tone };
}
