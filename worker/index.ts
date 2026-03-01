/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

// ── Push notification handler ───────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: { title: string; body: string; icon?: string; tag?: string; data?: Record<string, string> };
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Budo League", body: event.data.text() };
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    tag: payload.tag || "budo-league",
    renotify: true,
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// ── Notification click handler ──────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Default to dashboard, but use the link from push data if provided
  const url = (event.notification.data?.link as string) || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if one is open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return self.clients.openWindow(url);
    })
  );
});
