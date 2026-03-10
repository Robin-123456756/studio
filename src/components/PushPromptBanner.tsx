"use client";

import { useState, useEffect } from "react";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { cn } from "@/lib/utils";
import { Bell, X, Loader2 } from "lucide-react";

const LS_KEY = "tbl_push_prompt_dismissed";

/**
 * One-time banner prompting users to enable push notifications.
 * Shows on the fantasy page for users who haven't subscribed and haven't dismissed.
 * Hides automatically if already subscribed, unsupported, or denied.
 */
export function PushPromptBanner() {
  const { status, subscribe } = usePushSubscription();
  const [dismissed, setDismissed] = useState(true); // start hidden to prevent flash
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const wasDismissed = localStorage.getItem(LS_KEY) === "1";
    setDismissed(wasDismissed);
  }, []);

  // Don't show if loading, already subscribed, unsupported, denied, or dismissed
  if (status === "loading" || status === "subscribed" || status === "unsupported" || status === "denied" || dismissed) {
    return null;
  }

  async function handleEnable() {
    setBusy(true);
    setError(null);
    const result = await subscribe();
    setBusy(false);
    if (result.ok) {
      setDismissed(true);
      localStorage.setItem(LS_KEY, "1");
    } else {
      setError(result.error || "Could not enable notifications");
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem(LS_KEY, "1");
  }

  return (
    <div className={cn(
      "relative rounded-xl border bg-gradient-to-r from-[#37003C]/10 to-[#6b1d5e]/10",
      "p-3 mb-3"
    )}>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-muted/60 grid place-items-center hover:bg-muted"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      </button>

      <div className="flex items-start gap-3 pr-6">
        <div className="h-9 w-9 rounded-full bg-[#37003C] grid place-items-center shrink-0 mt-0.5">
          <Bell className="h-4 w-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">Enable Notifications</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Get score updates, deadline reminders & match alerts
          </div>
          {error && (
            <div className="text-xs text-destructive mt-1">{error}</div>
          )}
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className={cn(
              "mt-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition",
              "bg-[#37003C] text-white hover:bg-[#37003C]/90",
              busy && "opacity-50"
            )}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin inline mr-1" />
            ) : null}
            {busy ? "Enabling..." : "Enable"}
          </button>
        </div>
      </div>
    </div>
  );
}
