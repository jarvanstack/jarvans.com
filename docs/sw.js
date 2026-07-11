// Retire existing PWA installations. This file can be removed after old
// service worker registrations have had enough time to update.
self.addEventListener('install', function (event) {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(cacheNames.map(function (cacheName) {
          return caches.delete(cacheName);
        }));
      })
      .then(function () {
        return self.clients.claim();
      })
      .then(function () {
        return self.registration.unregister();
      })
      .then(function () {
        return self.clients.matchAll({ type: 'window' });
      })
      .then(function (clients) {
        return Promise.all(clients.map(function (client) {
          return client.navigate(client.url);
        }));
      })
  );
});
