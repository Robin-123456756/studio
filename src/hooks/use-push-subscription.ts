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

/** Wait for a SW registration to have an active worker, with timeout. */
function waitForActive(reg: ServiceWorkerRegistration, ms: number): Promise<ServiceWorkerRegistration> {
  if (reg.active) return Promise.resolve(reg);
  return new Promise((resolve, reject) => {
    const worker = reg.installing || reg.waiting;
    if (!worker) { reject(new Error("No worker found")); return; }

    const timer = setTimeout(() => reject(new Error("SW activation timed out")), ms);

    worker.addEventListener("statechange", () => {
      if (worker.state === "activated") {
        clearTimeout(timer);
        resolve(reg);
      } else if (worker.state === "redundant") {
        clearTimeout(timer);
        reject(new Error("SW became redundant"));
      }
    });
  });
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
        // Quick check — don't block mount for long
        const regs = await navigator.serviceWorker.getRegistrations();
        const activeReg = regs.find((r) => r.active);
        if (activeReg) {
          const sub = await activeReg.pushManager.getSubscription();
          setStatus(sub ? "subscribed" : "unsubscribed");
        } else {
          setStatus("unsubscribed");
        }
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

      // Step 3: Get an active service worker
      let reg: ServiceWorkerRegistration | null = null;

      // Try 1: Check if the main SW (from next-pwa) is already active
      const regs = await navigator.serviceWorker.getRegistrations();
      reg = regs.find((r) => r.active) ?? null;

      // Try 2: Register the main SW and wait briefly
      if (!reg) {
        try {
          const mainReg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
          reg = await waitForActive(mainReg, 4000);
        } catch {
          reg = null;
        }
      }

      // Try 3: Fall back to minimal push-only SW (no precaching, always activates)
      if (!reg) {
        try {
          // Unregister any broken SWs first
          const broken = await navigator.serviceWorker.getRegistrations();
          for (const r of broken) await r.unregister();

          const pushReg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
          reg = await waitForActive(pushReg, 4000);
        } catch (fallbackErr: any) {
          return { ok: false, error: `Could not activate service worker: ${fallbackErr?.message || fallbackErr}` };
        }
      }

      if (!reg?.active) {
        return { ok: false, error: "Service worker not available. Try refreshing the page." };
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
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
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
