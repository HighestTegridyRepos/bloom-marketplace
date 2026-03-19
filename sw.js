// SiamClones Service Worker — Network-only for HTML, cache for static assets
// Version bump: increment this on each deploy for cache busting
const CACHE_VERSION = 8;
const CACHE_NAME = `siamclones-v${CACHE_VERSION}`;

// Only cache non-HTML assets — HTML is always fetched from network
// to prevent stale page loads that cause white screens
const STATIC_ASSETS = [
  '/favicon.svg',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Install — pre-cache static assets (NOT HTML)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches + force-reload all open pages
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => {
      // Purge any stale CDN or HTML entries from the new cache
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.keys().then((requests) => {
          return Promise.all(
            requests
              .filter((req) => {
                const u = new URL(req.url);
                return u.hostname !== self.location.hostname ||
                       req.url.includes('unpkg.com') ||
                       u.pathname.endsWith('.html') ||
                       u.pathname === '/';
              })
              .map((req) => cache.delete(req))
          );
        });
      });
    }).then(() => {
      return self.clients.claim();
    }).then(() => {
      // Force-reload all open pages so they get fresh HTML from the network.
      // This works even if the old page has no controllerchange listener.
      return self.clients.matchAll({ type: 'window' }).then((clients) => {
        clients.forEach((client) => {
          client.navigate(client.url);
        });
      });
    })
  );
});

// Fetch strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // Network-first for Supabase API calls (always want fresh data)
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Network-only for external resources (fonts, any remaining CDN)
  // All JS libs are now self-hosted, but fonts still come from Google
  if (url.hostname !== self.location.hostname && !url.hostname.includes('supabase')) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-only for HTML pages — NEVER serve cached HTML
  // Stale cached HTML is the #1 cause of white-page bugs
  if (request.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(fetch(request));
    return;
  }

  // Stale-while-revalidate for same-origin static assets (JS, CSS, images)
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }
});
