// mobile-bottom-nav.tsx

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Home,
  Trophy,
  CalendarDays,
  MoreHorizontal,
  Users,
  Medal,
  Settings,
  Star,
  UserCircle2,
  ArrowLeftRight,
  ChevronRight,
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
  { href: "/dashboard/fantasy", label: "Fantasy", Icon: Trophy },
] as const;

// PL-style "More" items
const moreItems = [
  { href: "/dashboard/settings", label: "myPL Settings", Icon: Settings },
  { href: "/dashboard/teams", label: "Teams", Icon: Users },
  { href: "/dashboard/players", label: "Players", Icon: UserCircle2 },
  { href: "/dashboard/transfers", label: "Transfers", Icon: ArrowLeftRight },
  { href: "/dashboard/results", label: "Results", Icon: Medal },
  { href: "/dashboard/reviews", label: "Reviews", Icon: Star },
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
        "md:hidden fixed bottom-0 left-0 right-0 z-[9999]",
        "border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70",
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      <div className="mx-auto w-full max-w-app px-2 py-2">
        {/* 4 columns: Latest, Matches, Fantasy, More */}
        <div className="grid grid-cols-4 gap-1">
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

          {/* MORE – opens PL-style list */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2",
                  "text-muted-foreground hover:text-foreground transition active:scale-[0.98]"
                )}
                aria-label="More"
                type="button"
              >
                <div className="grid h-10 w-10 place-items-center rounded-2xl">
                  <MoreHorizontal className="h-5 w-5" />
                </div>
                <span className="text-[11px] leading-none font-medium">
                  More
                </span>
              </button>
            </SheetTrigger>

            {/* ✅ Make the bottom sheet itself scrollable */}
            <SheetContent
              side="bottom"
              className="rounded-t-3xl pb-[env(safe-area-inset-bottom)] max-h-[80vh] overflow-y-auto"
            >
              <SheetHeader className="pb-3 sticky top-0 bg-background">
                <SheetTitle>More</SheetTitle>
              </SheetHeader>

              <nav className="space-y-1 pb-4">
                {moreItems.map(({ href, label, Icon }) => (
                  <SheetClose asChild key={href}>
                    <Link
                      href={href}
                      className="flex items-center justify-between rounded-2xl bg-card px-4 py-3 text-sm font-medium hover:bg-accent/10 active:bg-accent/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-[15px]">{label}</span>
                      </div>

                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </Link>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
