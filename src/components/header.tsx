"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/dashboard/fantasy": "Fantasy",
  "/dashboard/matches": "Matches",
  "/dashboard/explore": "Explore",
  "/dashboard/players": "Players",
  "/dashboard/transfers": "Transfers",
  "/dashboard/fixtures": "Fixtures",
  "/dashboard/scores": "Scores",
  "/dashboard/more": "More",
};

export default function Header() {
  const pathname = usePathname();

  // On the main dashboard, the hero handles branding — no header needed
  if (pathname === "/dashboard") return null;

  // Find the matching title (longest prefix match)
  let title: string | null = null;
  for (const [prefix, label] of Object.entries(pageTitles)) {
    if (pathname.startsWith(prefix)) {
      title = label;
      break;
    }
  }

  if (!title) return null;

  return (
    <header className="sticky top-0 z-40 md:hidden backdrop-blur-md bg-background/80 border-b border-border/50">
      <div className="flex items-center h-11 px-4">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
      </div>
    </header>
  );
}
