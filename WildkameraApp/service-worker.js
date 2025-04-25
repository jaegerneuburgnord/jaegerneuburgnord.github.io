/**
 * service-worker.js
 * Service Worker für die Wildkamera SMS-Steuerung PWA mit detailliertem Debug-Logging
 */
const CACHE_NAME = 'wildkamera-cache-v1.0.6';  // Versionsnummer erhöhen
const ASSETS = [
  '/',
  './index.html',
  './styles.css',
  './styles-css.css',
  './styles-extensions.css',
  './app.js',
  './camera-settings.js',
  './config.js',
  './db-manager.js',
  './offline-html.html',
  './offline-sync-manager.js',
  './sms-commands.js',
  './sms-manager.js',
  './sync-manager.js',
  './ui-extensions.js',
  './wildkamera-icon.svg',
  './manifest.json',
  './icons/favicon.png',
  './icons/favicon.ico',
  './icons/icon-144x144.png',
  './icons/icon-192x192.png',
  // Externe Ressourcen zum Cachen (optional)
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Verbesserte Install-Logik mit Update-Mechanismus
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return Promise.all(
          ASSETS.map(asset =>
            cache.add(asset).catch(err => {
              console.error(`[ServiceWorker] Fehler beim Cachen: ${asset}`, err);
              return Promise.resolve();
            })
          )
        );
      })
      .then(() => {
        console.log('[ServiceWorker] Install abgeschlossen: Assets verarbeitet');
        return self.skipWaiting();  // Sofortiger Service Worker Wechsel
      })
  );
});

// Activate-Event mit verbesserter Cache-Bereinigung
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => 
      Promise.all(
        cacheNames.map(cacheName => {
          // Alte Caches löschen
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => {
      console.log('[ServiceWorker] Alte Caches gelöscht');
      return self.clients.claim();  // Sofortige Kontrolle aller Clients
    })
  );
});

// Verbesserte Fetch-Strategie mit Netzwerk-Priorität
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Erfolgreiche Netzwerkantwort
        if (networkResponse && networkResponse.ok) {
          // Netzwerkantwort in Cache speichern
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return networkResponse;
        }
        // Bei Netzwerkfehler Cache verwenden
        return caches.match(event.request);
      })
      .catch(() => {
        // Offline-Fallback
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;
          
          // Spezifischer Offline-Fallback für Navigationen
          if (event.request.mode === 'navigate') {
            return caches.match('/offline-html.html');
          }
          
          // Generische Offline-Antwort
          return new Response('Offline und keine gecachte Version verfügbar.', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Update-Check Mechanismus
self.addEventListener('message', event => {
  if (event.data === 'CHECK_FOR_UPDATE') {
    self.registration.update();
  }
});