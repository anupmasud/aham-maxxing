/* AhamMaxxing service worker — caches the app shell so the app opens instantly and
   works with no signal. There is no API to cache: all data lives in
   localStorage, written by app.js. */
const CACHE = "aham-maxxing-shell-v1";
const SHELL = [
  ".", "index.html", "styles.css", "app.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;      // let fonts go to the network
  if (e.request.method !== "GET") return;

  // Stale-while-revalidate: paint from cache, refresh in the background. A
  // bump to CACHE force-purges everything through the activate handler.
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fromNetwork = fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => cached || caches.match("index.html"));
      return cached || fromNetwork;
    })
  );
});
