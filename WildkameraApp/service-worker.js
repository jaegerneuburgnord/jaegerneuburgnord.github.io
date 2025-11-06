/**
 * service-worker.js
 * Service Worker für die Wildkamera SMS-Steuerung PWA mit detailliertem Debug-Logging
 * Erweitert mit Offline-Karten-Caching
 */
const CACHE_NAME = 'wildkamera-cache-v1.0.8';
const TILE_CACHE_NAME = 'wildkamera-tiles-v1.0.1'; // Separater Cache für Karten-Tiles
const MAX_TILE_CACHE_SIZE = 500; // Maximal 500 Tiles im Cache
const ASSETS = [
  '/',
  './index.html',
  './styles.css',
  './styles-css.css',
  './styles-extensions.css',
  './map-styles.css',
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
  './map-view.js',
  './swipe-navigation.js',
  './kml-manager.js',
  './layout-switcher.js',
  './wildkamera-icon.svg',
  './manifest.json',
  './icons/favicon.png',
  './icons/favicon.ico',
  './icons/icon-144x144.png',
  './icons/icon-192x192.png',
  // Externe Ressourcen zum Cachen (optional)
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/js/materialize.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
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
          // Alte Caches löschen (außer TILE_CACHE_NAME)
          if (cacheName !== CACHE_NAME && cacheName !== TILE_CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    ).then(() => {
      console.log('[ServiceWorker] Alte Caches gelöscht, Tile-Cache behalten');
      return self.clients.claim();  // Sofortige Kontrolle aller Clients
    })
  );
});

/**
 * Prüft ob die URL ein Karten-Tile ist
 */
function isTileRequest(url) {
  return url.includes('tile.openstreetmap.org') ||
         url.includes('mt1.google.com/vt') ||
         url.includes('server.arcgisonline.com') ||
         url.includes('tile.opentopomap.org') ||
         url.includes('/tiles/') ||
         (url.match(/\/\d+\/\d+\/\d+\.(png|jpg|jpeg)/) !== null);
}

/**
 * Limitiert die Anzahl der Tiles im Cache
 */
async function limitTileCache() {
  const cache = await caches.open(TILE_CACHE_NAME);
  const keys = await cache.keys();

  if (keys.length > MAX_TILE_CACHE_SIZE) {
    // Lösche älteste Tiles (FIFO)
    const deleteCount = keys.length - MAX_TILE_CACHE_SIZE;
    for (let i = 0; i < deleteCount; i++) {
      await cache.delete(keys[i]);
    }
    console.log(`[ServiceWorker] ${deleteCount} alte Tiles gelöscht`);
  }
}

// Verbesserte Fetch-Strategie mit Tile-Caching
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // CACHE-FIRST für Karten-Tiles (Offline-Support)
  if (isTileRequest(url)) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          // Wenn im Cache, direkt zurückgeben
          if (cachedResponse) {
            return cachedResponse;
          }

          // Ansonsten aus Netzwerk laden und cachen
          return fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
              // Limitiere Cache-Größe
              limitTileCache();
            }
            return networkResponse;
          }).catch(() => {
            // Offline und nicht im Cache
            return new Response('Tile nicht verfügbar', {
              status: 503,
              statusText: 'Offline'
            });
          });
        });
      })
    );
    return;
  }

  // NETWORK-FIRST für alle anderen Requests
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
        return caches.match(event.request).then(cachedResponse => {
          return cachedResponse || new Response('Nicht verfügbar', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
      .catch(() => {
        // Offline-Fallback
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) return cachedResponse;

          // Spezifischer Offline-Fallback für Navigationen
          if (event.request.mode === 'navigate') {
            return caches.match('/offline-html.html').then(offline => {
              return offline || new Response('Offline', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/html' }
              });
            });
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