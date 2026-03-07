// Minimal service worker for push notifications only.
// No precaching, no Workbox — guaranteed to install and activate.
self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", function (event) {
  if (!event.data) return;
  var payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { title: "Budo League", body: event.data.text() };
  }
  var options = {
    body: payload.body,
    icon: payload.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "budo-league",
    renotify: true,
    data: payload.data || {},
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  var url = (event.notification.data && event.notification.data.link) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
      for (var i = 0; i < clients.length; i++) {
        if (clients[i].url.indexOf(self.location.origin) !== -1 && "focus" in clients[i]) {
          clients[i].navigate(url);
          return clients[i].focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
