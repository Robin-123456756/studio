"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Home, Trophy, CalendarDays, Search, MoreHorizontal } from "lucide-react";

const tabs = [
  { href: "/dashboard", label: "Latest", Icon: Home },
  { href: "/dashboard/matches", label: "Matches", Icon: CalendarDays },
  { href: "/dashboard/fantasy", label: "Fantasy", Icon: Trophy },
  { href: "/dashboard/explore", label: "Explore", Icon: Search }, // ✅ NEW
  { href: "/dashboard/more", label: "More", Icon: MoreHorizontal },
] as const;

function isActiveRoute(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Bottom navigation"
      className={cn(
        "md:hidden fixed bottom-0 left-0 right-0 z-40",
        "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        "pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.08)]"
      )}
    >
      <div className="mx-auto w-full max-w-app px-2 py-2">
        {/* ✅ changed to 5 columns */}
        <div className="grid grid-cols-5 gap-1">
          {tabs.map(({ href, label, Icon }) => {
            const active = isActiveRoute(pathname, href);

            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2",
                  "transition active:scale-[0.98]",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-2xl",
                    active ? "bg-primary/10 shadow-sm" : "bg-transparent"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <span
                  className={cn(
                    "text-[11px] leading-none",
                    active ? "font-semibold" : "font-medium"
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
