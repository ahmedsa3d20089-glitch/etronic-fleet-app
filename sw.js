const CACHE_NAME = "etronic-fleet-v3";
const CORE_ASSETS = [
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js",
  "https://cdn.tailwindcss.com"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch(() => {
            // ignore individual failures (e.g. offline first install) so the rest still cache
          })
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always try to get the latest version from the server first.
// Only fall back to the cached copy if the network request fails (e.g. offline).
// This means updates (like new logos, permissions, etc.) show up immediately
// on the very next load, instead of waiting for a second reload.
self.addEventListener("fetch", (event) => {
  // IMPORTANT: only intercept simple GET requests. Firestore's real-time
  // sync uses POST-based requests (and cross-origin requests to Google's
  // servers) to keep the live connection open -- the Cache API cannot
  // store non-GET requests, and intercepting them here was breaking
  // Firestore's live updates (fuel/maintenance/odometer data wasn't
  // loading) and throwing "Request method 'POST' is unsupported" errors.
  // Anything that isn't a plain GET is left completely alone.
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone).catch(() => {}));
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
