// ============================================================
// Firebase Cloud Messaging — استقبال Push حقيقي والتطبيق مغلق تمامًا
// ============================================================
// ملاحظة: نفس firebaseConfig الموجود في index.html. لو حصل أي خطأ هنا
// (مثلًا SDK متاح لكن Push مش مفعّل)، بنتجاهله بصمت — باقي الـ Service
// Worker (التخزين المؤقت والتحديثات) يفضل شغّال عادي زي ما هو.
try {
  importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

  firebase.initializeApp({
    apiKey: "AIzaSyCWsNzyrcUREB6xGWOGdF7iUevkUIdd0js",
    authDomain: "etronic-fleet.firebaseapp.com",
    projectId: "etronic-fleet",
    storageBucket: "etronic-fleet.firebasestorage.app",
    messagingSenderId: "987528911688",
    appId: "1:987528911688:web:c53fa37e6e3ae4a76df17d",
  });

  const messaging = firebase.messaging();

  // يُستدعى فقط لما التطبيق يكون مغلق أو في الخلفية تمامًا — الرسائل وقت
  // فتح التطبيق بيتعامل معاها onMessage جوه index.html مباشرة.
  messaging.onBackgroundMessage((payload) => {
    const n = payload.notification || {};
    const d = payload.data || {};
    self.registration.showNotification(n.title || "إشعار جديد", {
      body: n.body || "",
      icon: "./icon-192.png",
      badge: "./icon-192.png",
      dir: "rtl",
      lang: "ar",
      data: d,
      tag: d.entity_id ? `${d.type}-${d.entity_id}` : undefined,
    });
  });
} catch (e) {
  // فشل صامت — لا نريد كسر باقي الـ Service Worker بسبب مشكلة في FCM
}

const CACHE_NAME = "etronic-fleet-v4";
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

// عند الضغط على إشعار: نركّز على نافذة التطبيق المفتوحة إن وُجدت، أو نفتح
// واحدة جديدة، ونمرّر بيانات التوجيه (screen_to_open / entity_id) للتطبيق
// عبر postMessage حتى ينتقل مباشرة للشاشة المناسبة.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsList) => {
      for (const client of clientsList) {
        if ("focus" in client) {
          client.postMessage({ type: "notification_click", data });
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("./index.html");
      }
    })
  );
});
