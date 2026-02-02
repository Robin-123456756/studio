"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type Mode = "light" | "dark" | "system";

export function ThemeSettingRow() {
  const { theme, setTheme, systemTheme } = useTheme();
  const current = (theme ?? "system") as Mode;

  function Button({
    value,
    label,
  }: {
    value: Mode;
    label: string;
  }) {
    const active = current === value;

    return (
      <button
        type="button"
        onClick={() => setTheme(value)}
        className={cn(
          "px-3 py-2 rounded-xl text-sm font-semibold transition",
          active
            ? "bg-background shadow border"
            : "text-muted-foreground hover:bg-accent/20"
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">Appearance</div>
        <div className="text-xs text-muted-foreground">
          {current === "system"
            ? `System (${systemTheme ?? "…"})`
            : current === "dark"
            ? "Dark"
            : "Light"}
        </div>
      </div>

      <div className="rounded-2xl bg-muted p-1 inline-flex shrink-0">
        <Button value="light" label="Light" />
        <Button value="dark" label="Dark" />
        <Button value="system" label="System" />
      </div>
    </div>
  );
}
