"use client";

import { usePushSubscription } from "@/hooks/use-push-subscription";
import { cn } from "@/lib/utils";
import { Bell, BellOff, BellRing } from "lucide-react";

export function PushNotificationToggle() {
  const { status, subscribe, unsubscribe } = usePushSubscription();

  if (status === "loading") {
    return (
      <div className="py-4 border-b border-border/60">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-base font-semibold">Push Notifications</div>
            <div className="text-sm text-muted-foreground">Checking...</div>
          </div>
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
        </div>

        <button
          type="button"
          onClick={isSubscribed ? unsubscribe : subscribe}
          className={cn(
            "px-4 py-2 rounded-xl text-sm font-semibold transition shrink-0 flex items-center gap-2",
            isSubscribed
              ? "bg-background shadow border text-foreground"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {isSubscribed ? (
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
