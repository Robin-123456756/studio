"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Settings, Users, UserCircle2, ArrowLeftRight, Medal, Star, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/dashboard/settings", label: "myTBL Settings", Icon: Settings },
  { href: "/dashboard/more/tbl-rules", label: "TBL fantasy Rules", Icon: BookOpen },
  { href: "/dashboard/teams", label: "Teams", Icon: Users },
  { href: "/dashboard/players", label: "Players", Icon: UserCircle2 },
  { href: "/dashboard/transfers", label: "Transfers", Icon: ArrowLeftRight },
  { key: "results", href: "/dashboard/matches?tab=results", label: "Results", Icon: Medal },
  { href: "/dashboard/reviews", label: "Feedback", Icon: Star },
] as const;

export default function MorePage() {
  const [gwLabel, setGwLabel] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/gameweeks/current", { cache: "no-store" });
        const json = await res.json();
        const gw = json.current;
        if (gw) {
          const name = gw.name || `Matchday ${gw.id}`;
          setGwLabel(name);
        }
      } catch {}
    })();
  }, []);

  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28">
      {/* Title like EPL */}
      <h1 className="text-3xl font-extrabold tracking-tight">More</h1>

      {/* List */}
      <div className="mt-4">
        {items.map(({ href, label, Icon, ...rest }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center justify-between py-4",
              "border-b border-border/60",
              "active:opacity-80"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <span className="text-base font-semibold">{label}</span>
                {"key" in rest && rest.key === "results" && gwLabel ? (
                  <div className="text-xs text-muted-foreground">{gwLabel}</div>
                ) : null}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
