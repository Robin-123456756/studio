"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Header() {
  const pathname = usePathname();
  const isDashboardHome = pathname === "/dashboard";

  // Only show header on dashboard home page
  if (!isDashboardHome) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto w-full max-w-5xl px-4 py-3 md:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="group flex items-center gap-3 rounded-2xl p-2 -ml-2 hover:bg-muted/60 transition-colors"
          >
            <img
              src="/icon.png"
              alt="Budo League"
              className="h-14 w-14 object-contain"
            />

            <div className="min-w-0">
              <div className="text-base font-semibold tracking-tight font-headline">
                The <span className="text-primary">Budo</span> League
              </div>
            </div>
          </Link>

          <div className="hidden sm:flex items-center gap-2">
            <div className="rounded-full border bg-card px-3 py-1 text-xs font-semibold text-foreground">
            </div>
            <div className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
              60 min matches
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
