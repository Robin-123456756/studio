"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Trophy,
  CalendarDays,
  Table2,
  MoreHorizontal,
  Users,
  Compass,
  Medal,
  Bell,
  Settings,
  Star,
} from "lucide-react";

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";

const tabs = [
  { href: "/dashboard", label: "Latest", Icon: Home },
  { href: "/dashboard/matches", label: "Matches", Icon: CalendarDays },
  { href: "/dashboard/table", label: "Table", Icon: Table2 },
  { href: "/dashboard/fantasy", label: "Fantasy", Icon: Trophy },
] as const;

const moreItems = [
  { href: "/dashboard/teams", label: "Teams", Icon: Users },
  { href: "/dashboard/explore", label: "Explore", Icon: Compass },
  { href: "/dashboard/scores", label: "Results", Icon: Medal },
  { href: "/dashboard/notifications", label: "Notifications", Icon: Bell },
  { href: "/dashboard/reviews", label: "Reviews", Icon: Star },
  { href: "/dashboard/settings", label: "Settings", Icon: Settings },
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
        // ✅ Keep nav above content but BELOW the sheet overlay/content (sheet is z-50)
        "md:hidden fixed bottom-0 left-0 right-0 z-40",
        "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div className="mx-auto w-full max-w-app px-2 py-2">
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
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div
                  className={cn(
                    "grid h-10 w-10 place-items-center rounded-2xl",
                    active ? "bg-muted shadow-sm" : "bg-transparent"
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

          {/* MORE = opens sheet (no route) */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2",
                  "text-muted-foreground hover:text-foreground transition active:scale-[0.98]"
                )}
                aria-label="More"
              >
                <div className="grid h-10 w-10 place-items-center rounded-2xl">
                  <MoreHorizontal className="h-5 w-5" />
                </div>
                <span className="text-[11px] leading-none font-medium">More</span>
              </button>
            </SheetTrigger>

            <SheetContent side="bottom" className="rounded-t-3xl">
              <SheetHeader className="pb-2">
                <SheetTitle>More</SheetTitle>
              </SheetHeader>

              <div className="grid grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)]">
                {moreItems.map(({ href, label, Icon }) => (
                  <SheetClose asChild key={href}>
                    <Link
                      href={href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm",
                        "hover:bg-accent transition-colors"
                      )}
                    >
                      <div className="grid h-10 w-10 place-items-center rounded-2xl bg-muted">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="font-medium">{label}</div>
                    </Link>
                  </SheetClose>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
