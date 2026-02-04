"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

function getPageTitle(pathname: string) {
  if (!pathname || pathname === "/") return "Home";
  if (pathname === "/dashboard") return "Latest";
  const seg = pathname.split("/").filter(Boolean).pop() ?? "";
  return seg.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export default function Header() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="px-4 pt-3 pb-4 space-y-3 md:space-y-0 md:flex md:h-16 md:items-center md:gap-4 md:px-6 lg:px-8">
        {/* ✅ Mobile top row: logo + bell */}
        <div className="flex items-center justify-between md:hidden">
          <div className="hidden">
            <SidebarTrigger />
          </div>

          <Link
            href="/dashboard"
            className="rounded-2xl bg-white px-3 py-2 ring-1 ring-border shadow-sm overflow-hidden"
          >
            <img
              src="/icon.png"
              alt="Budo League"
              className="h-8 w-auto object-contain scale-[1.6]"
              style={{ transformOrigin: "center" }}
            />
          </Link>

          <button
            className="grid h-10 w-10 place-items-center rounded-full border bg-background shadow-sm"
            aria-label="Notifications"
            type="button"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>

        {/* ✅ Mobile search bar (NEW) */}
        <div className="md:hidden">
          <div
            className={cn(
              "flex items-center gap-3 rounded-2xl border bg-background/95",
              "px-4 py-3 shadow-sm"
            )}
          >
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              placeholder="Search matches, teams or players"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* ✅ Desktop left */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-2xl bg-white px-4 py-2 ring-1 ring-border shadow-sm overflow-hidden"
          >
            <img
              src="/icon.png"
              alt="Budo League"
              className="h-10 w-auto object-contain scale-[1.4]"
              style={{ transformOrigin: "center" }}
            />
          </Link>

          <div>
            <div className="text-xs text-muted-foreground">Page</div>
            <div className="text-sm font-semibold">{title}</div>
          </div>
        </div>

        {/* (Optional) Desktop search bar too */}
        <div className="hidden md:flex flex-1 justify-center">
          <div className="w-full max-w-xl flex items-center gap-3 rounded-2xl border bg-background/95 px-4 py-2 shadow-sm">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              placeholder="Search matches, teams or players"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* (Optional) Desktop bell */}
        <div className="hidden md:flex items-center justify-end">
          <button
            className="grid h-10 w-10 place-items-center rounded-full border bg-background shadow-sm"
            aria-label="Notifications"
            type="button"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
