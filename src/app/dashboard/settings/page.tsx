"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { PushNotificationToggle } from "@/components/PushNotificationToggle";
import { ThemeSettingRow } from "@/components/theme-setting";

export default function SettingsPage() {
  return (
    <div className="mx-auto w-full max-w-app px-4 pt-4 pb-28">
      {/* EPL-like header */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/more"
          className="h-10 w-10 rounded-full grid place-items-center hover:bg-accent/20 active:bg-accent/30"
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">myTBL Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Personalise your experience</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="py-4 border-b border-border/60">
          <ThemeSettingRow />
        </div>
        <PushNotificationToggle />
      </div>
    </div>
  );
}
