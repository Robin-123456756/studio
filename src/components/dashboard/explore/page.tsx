"use client";

import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Search } from "lucide-react";

export default function ExplorePage() {
  const [q, setQ] = React.useState("");

  return (
    <div className="space-y-4">
      <div className="text-2xl font-extrabold tracking-tight">Explore</div>

      <Card className="rounded-2xl">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 rounded-2xl border bg-background px-4 py-3">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search matches, teams or players"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        Start typing to search…
      </div>
    </div>
  );
}
