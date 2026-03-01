"use client";

import { useState, useEffect, useCallback } from "react";

type PushStatus = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

/** Convert VAPID public key from base64url to Uint8Array (required by PushManager). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Race a promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

export function usePushSubscription() {
  const [status, setStatus] = useState<PushStatus>("loading");

  // Check current state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Basic support check
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    // Check if SW is registered and has an active push subscription.
    // Timeout after 3s — if SW hasn't activated, treat as "unsubscribed"
    // (subscribe() will register/wait for SW when the user taps Enable).
    (async () => {
      try {
        const reg = await withTimeout(navigator.serviceWorker.ready, 3000);
        if (!reg) {
          // SW not active yet — that's OK, user can still subscribe
          setStatus("unsubscribed");
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "unsubscribed");
      } catch {
        // Any error — default to unsubscribed so the button is visible
        setStatus("unsubscribed");
      }
    })();
  }, []);

  const subscribe = useCallback(async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        return false;
      }
      if (permission !== "granted") {
        return false;
      }

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("VAPID key not configured");
        return false;
      }

      // Wait for SW — give it up to 10s during subscribe since user is actively waiting
      const reg = await withTimeout(navigator.serviceWorker.ready, 10000);
      if (!reg) {
        console.error("Service worker not ready after 10s");
        return false;
      }

      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      // Send subscription to our API
      const subJson = subscription.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Failed to save push subscription:", err);
        return false;
      }

      setStatus("subscribed");
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      return false;
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    try {
      const reg = await withTimeout(navigator.serviceWorker.ready, 5000);
      if (reg) {
        const subscription = await reg.pushManager.getSubscription();
        if (subscription) {
          const endpoint = subscription.endpoint;
          await subscription.unsubscribe();
          await fetch("/api/push/subscribe", {
            method: "DELETE",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint }),
          });
        }
      }

      setStatus("unsubscribed");
      return true;
    } catch (err) {
      console.error("Push unsubscribe error:", err);
      return false;
    }
  }, []);

  return { status, subscribe, unsubscribe };
}
