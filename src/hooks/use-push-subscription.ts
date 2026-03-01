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
  const [lastError, setLastError] = useState<string | null>(null);

  // Check current state on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    (async () => {
      try {
        const reg = await withTimeout(navigator.serviceWorker.ready, 3000);
        if (!reg) {
          setStatus("unsubscribed");
          return;
        }
        const sub = await reg.pushManager.getSubscription();
        setStatus(sub ? "subscribed" : "unsubscribed");
      } catch {
        setStatus("unsubscribed");
      }
    })();
  }, []);

  const subscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setLastError(null);
    try {
      // Step 1: Request permission
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setStatus("denied");
        return { ok: false, error: "Permission denied by browser" };
      }
      if (permission !== "granted") {
        return { ok: false, error: `Permission not granted (${permission})` };
      }

      // Step 2: Check VAPID key
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        return { ok: false, error: "VAPID key not configured on server" };
      }

      // Step 3: Wait for service worker
      const reg = await withTimeout(navigator.serviceWorker.ready, 10000);
      if (!reg) {
        return { ok: false, error: "Service worker not ready (timeout)" };
      }

      // Step 4: Subscribe to push
      let subscription: PushSubscription;
      try {
        subscription = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        });
      } catch (pushErr: any) {
        return { ok: false, error: `Push subscribe failed: ${pushErr?.message || pushErr}` };
      }

      // Step 5: Save to server
      const subJson = subscription.toJSON();
      let res: Response;
      try {
        res = await fetch("/api/push/subscribe", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            keys: subJson.keys,
          }),
        });
      } catch (fetchErr: any) {
        return { ok: false, error: `Network error saving subscription: ${fetchErr?.message}` };
      }

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        return { ok: false, error: `Server error (${res.status}): ${errBody?.error || "unknown"}` };
      }

      setStatus("subscribed");
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: `Unexpected: ${err?.message || err}` };
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    setLastError(null);
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
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: `Unsubscribe failed: ${err?.message || err}` };
    }
  }, []);

  return { status, lastError, subscribe, unsubscribe };
}
