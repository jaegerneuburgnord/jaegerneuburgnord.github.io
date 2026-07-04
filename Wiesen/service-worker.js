// Selbstzerstörender Service Worker: löscht alle Caches, deregistriert sich
// und lädt alle offenen Clients neu, damit die Wipe-Seite (index.html) greift.
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(cacheNames.map(name => caches.delete(name))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        clients.forEach(client => client.navigate(client.url));
      })
  );
});

// Bewusst KEIN fetch-Handler: alle Requests gehen direkt ins Netz.
