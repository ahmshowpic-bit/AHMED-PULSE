const CACHE_NAME = 'ahmed-pulse-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.css',
  '/icon-192.png',
  '/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Opened cache');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Ignore non-GET requests and external API requests (like Firebase)
  if (event.request.method !== 'GET' || event.request.url.includes('firestore.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached response if found
      if (response) {
        return response;
      }

      // Clone the request for the fetch call
      const fetchRequest = event.request.clone();

      return fetch(fetchRequest).then(networkResponse => {
        // Check if we received a valid response
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Clone the response for caching
        const responseToCache = networkResponse.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Fallback for navigation requests if offline and not cached
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
