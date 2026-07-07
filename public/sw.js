/* Progress service worker.
   Its whole job for notifications: sit in the background (even when every tab is closed) and,
   when the push server sends a message, show a notification. Kept dependency-free and served
   from the site root so its scope covers the whole app. */

self.addEventListener("install", () => {
  // Activate a new version immediately instead of waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A push arrived from our server. The payload is the JSON we sent from lib/webpush.ts.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || "Progress";
  const options = {
    body: data.body || "",
    icon: "/api/pwa-icon?size=192",
    badge: "/api/pwa-icon?size=192",
    tag: data.tag,                       // same tag replaces an existing notification instead of stacking
    data: { url: data.url || "/" },      // where to go when tapped
    vibrate: [80, 40, 80],
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// The user tapped the notification — focus an open tab or open a new one at the target url.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
