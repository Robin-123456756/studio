"use client";

import * as React from "react";
import Link from "next/link";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="px-4 py-3 md:h-16 md:flex md:items-center md:justify-between md:px-6 lg:px-8">
        {/* Mobile: logo only */}
        <div className="flex items-center justify-between md:hidden">
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

          {/* optional right icon area (empty for now) */}
          <div className="h-10 w-10" />
        </div>

        {/* Desktop: logo only */}
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
        </div>
      </div>
    </header>
  );
}
