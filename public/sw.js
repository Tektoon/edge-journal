const CACHE_NAME = 'edge-journal-v2';

// Installation — cache minimal
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['/']))
  );
  self.skipWaiting();
});

// Activation — supprime anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — TOUJOURS le réseau en priorité, cache uniquement si offline
self.addEventListener('fetch', (event) => {
  // Laisser passer TOUTES les requêtes API et Supabase
  if (
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('/rest/') ||
    event.request.url.includes('/auth/') ||
    event.request.url.includes('/realtime/') ||
    event.request.method !== 'GET'
  ) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache uniquement les fichiers statiques JS/CSS
        if (response && response.status === 200) {
          const url = event.request.url;
          if (url.includes('.js') || url.includes('.css') || url.includes('.png') || url.includes('.ico')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
        }
        return response;
      })
      .catch(() => {
        // Offline : retourner depuis le cache
        return caches.match(event.request) || caches.match('/');
      })
  );
});
