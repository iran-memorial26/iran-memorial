/* Iran Memorial — Service Worker.
 *
 * Design goals for the audience inside Iran (VPN drops, ISP throttling,
 * Tor-style latency):
 *   - HTML pages: network-first with cache fallback. Stale-but-readable
 *     beats a blank screen when the network blinks.
 *   - Static assets (/_next/static/*, fonts, /icons, /og): cache-first.
 *     They never change for a given URL hash, so caching forever is safe.
 *   - API endpoints (/api/*): network-only. Pass-through. We don't want
 *     stale mutation responses or stale search results in offline mode.
 *   - Other GETs: stale-while-revalidate. Best for /photos, /sitemap, RSS.
 *
 * Cache version bump → all caches purged on activate. Bump CACHE_VERSION
 * to invalidate. Per-cache size caps keep the SW friendly on small devices.
 */

const CACHE_VERSION = "v1";
const PAGES_CACHE = `iran-memorial-pages-${CACHE_VERSION}`;
const STATIC_CACHE = `iran-memorial-static-${CACHE_VERSION}`;
const SWR_CACHE = `iran-memorial-swr-${CACHE_VERSION}`;
const ALL_CACHES = [PAGES_CACHE, STATIC_CACHE, SWR_CACHE];

const PAGES_MAX_ENTRIES = 60;
const STATIC_MAX_ENTRIES = 200;
const SWR_MAX_ENTRIES = 200;

// Pre-cache the homepage entry on install so first-load-offline is graceful.
// next-intl rewrites bare `/` to a locale; we pre-cache the four big ones.
const PRECACHE_URLS = ["/en", "/de", "/fa", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES_CACHE);
      // Best-effort precache. A failed precache must not break install —
      // the SW still installs and starts serving from network.
      await Promise.allSettled(
        PRECACHE_URLS.map((url) => cache.add(url).catch(() => null))
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Purge old cache versions.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("iran-memorial-") && !ALL_CACHES.includes(k))
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Trim a cache to a max entry count (FIFO). Cheap eviction since browsers
// expose ordered keys.
async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  for (const k of keys.slice(0, keys.length - maxEntries)) {
    await cache.delete(k);
  }
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/og/") ||
    url.pathname === "/manifest.webmanifest" ||
    /\.(?:css|js|woff2?|ttf|otf|svg|png|jpe?g|gif|webp|avif|ico)$/i.test(url.pathname)
  );
}

function isHTMLNavigation(request, url) {
  if (request.mode === "navigate") return true;
  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html") && !url.pathname.startsWith("/api/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Same-origin only — third-party resources stay on their own caching.
  if (url.origin !== self.location.origin) return;

  // API: network-only. Never serve stale POST/PATCH responses or search results.
  if (url.pathname.startsWith("/api/")) return;

  // HTML navigations: network-first with cache fallback.
  if (isHTMLNavigation(request, url)) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok || fresh.status === 304) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(request, fresh.clone());
            // Trim after every successful fetch — async, not blocking.
            trimCache(PAGES_CACHE, PAGES_MAX_ENTRIES);
          }
          return fresh;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          // Final fallback: cached homepage if present, then a tiny offline
          // shell. Better than a blank Chromium error.
          const home = await caches.match("/en");
          if (home) return home;
          return new Response(
            "<!doctype html><meta charset=utf-8><title>Offline</title><style>body{background:#0a0d12;color:#a8aebb;font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;text-align:center}h1{color:#cba35a;font-weight:600;font-size:1.4rem}</style><h1>🕯 Iran Memorial</h1><p>Du bist offline. Sobald die Verbindung zurückkommt, lade neu.<br>You are offline. Reload when connectivity returns.<br>شما آفلاین هستید.</p>",
            {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            }
          );
        }
      })()
    );
    return;
  }

  // Static assets: cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, fresh.clone());
            trimCache(STATIC_CACHE, STATIC_MAX_ENTRIES);
          }
          return fresh;
        } catch (err) {
          // Cached miss + network miss = let the browser show its own error.
          // Throwing is the documented way to signal "I didn't handle this".
          throw err;
        }
      })()
    );
    return;
  }

  // Everything else (photos, sitemap, RSS): stale-while-revalidate.
  event.respondWith(
    (async () => {
      const cache = await caches.open(SWR_CACHE);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((fresh) => {
          if (fresh.ok) {
            cache.put(request, fresh.clone());
            trimCache(SWR_CACHE, SWR_MAX_ENTRIES);
          }
          return fresh;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })()
  );
});
