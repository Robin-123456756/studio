"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { upsertTeamName } from "@/lib/fantasyDb";

type TeamNameModalProps = {
  open: boolean;
  onSaved: (name: string) => void;
};

export function TeamNameModal({ open, onSaved }: TeamNameModalProps) {
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = value.trim();
  const isValid = trimmed.length >= 2 && trimmed.length <= 30;

  const validationMsg =
    value.length > 0 && trimmed.length < 2
      ? "Name must be at least 2 characters"
      : trimmed.length > 30
      ? "Name must be 30 characters or fewer"
      : null;

  async function handleSubmit() {
    if (!isValid || saving) return;
    try {
      setSaving(true);
      setError(null);
      await upsertTeamName(trimmed);
      onSaved(trimmed);
    } catch (e: any) {
      setError(e?.message || "Failed to save team name");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-sm translate-x-[-50%] translate-y-[-50%]",
            "rounded-2xl border bg-background p-6 shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          )}
        >
          <div className="flex flex-col space-y-1.5 text-center">
            <DialogPrimitive.Title className="text-lg font-semibold leading-none tracking-tight">
              Name Your Team
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground">
              Choose a team name to get started. You can change it later.
            </DialogPrimitive.Description>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="mt-4 space-y-3"
          >
            <input
              type="text"
              autoFocus
              placeholder="e.g. Kampala United FC"
              maxLength={30}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className={cn(
                "w-full rounded-lg border bg-background px-3 py-2 text-sm",
                "placeholder:text-muted-foreground/50",
                "focus:outline-none focus:ring-2 focus:ring-[#0D5C63] focus:border-transparent"
              )}
            />

            {validationMsg && (
              <p className="text-xs text-red-500">{validationMsg}</p>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={!isValid || saving}
              className={cn(
                "w-full rounded-lg bg-[#0D5C63] px-4 py-2.5 text-sm font-semibold text-white",
                "transition hover:bg-[#0D5C63]/90 active:bg-[#0D5C63]/80",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center justify-center gap-2"
              )}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : "Continue"}
            </button>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
