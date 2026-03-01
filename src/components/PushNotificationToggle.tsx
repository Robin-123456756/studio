"use client";

import { useState } from "react";
import { usePushSubscription } from "@/hooks/use-push-subscription";
import { cn } from "@/lib/utils";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";

export function PushNotificationToggle() {
  const { status, subscribe, unsubscribe } = usePushSubscription();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    setBusy(true);
    setError(null);
    try {
      const isSubscribed = status === "subscribed";
      const ok = isSubscribed ? await unsubscribe() : await subscribe();
      if (!ok) {
        setError(isSubscribed ? "Failed to disable" : "Failed to enable — check browser permissions");
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    }
    setBusy(false);
  }

  if (status === "loading") {
    return (
      <div className="py-4 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">Push Notifications</div>
            <div className="text-sm text-muted-foreground">Checking...</div>
          </div>
          <Loader2 className="h-5 w-5 text-muted-foreground animate-spin shrink-0" />
        </div>
      </div>
    );
  }

  if (status === "unsupported") {
    return (
      <div className="py-4 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">Push Notifications</div>
            <div className="text-sm text-muted-foreground">
              Not supported in this browser
            </div>
          </div>
          <BellOff className="h-5 w-5 text-muted-foreground shrink-0" />
        </div>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="py-4 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">Push Notifications</div>
            <div className="text-sm text-muted-foreground">
              Blocked — enable in browser settings
            </div>
          </div>
          <BellOff className="h-5 w-5 text-destructive shrink-0" />
        </div>
      </div>
    );
  }

  const isSubscribed = status === "subscribed";

  return (
    <div className="py-4 border-b border-border/60">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-base font-semibold">Push Notifications</div>
          <div className="text-sm text-muted-foreground">
            {isSubscribed
              ? "Receive goals, cards & match alerts"
              : "Get notified about live match events"}
          </div>
          {error && (
            <div className="text-sm text-destructive mt-1">{error}</div>
          )}
        </div>

        <button
          type="button"
          onClick={handleToggle}
          disabled={busy}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 flex items-center gap-2",
            isSubscribed
              ? "bg-background shadow border text-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
            busy && "opacity-50"
          )}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isSubscribed ? (
            <>
              <BellRing className="h-4 w-4" />
              On
            </>
          ) : (
            <>
              <Bell className="h-4 w-4" />
              Enable
            </>
          )}
        </button>
      </div>
    </div>
  );
}
