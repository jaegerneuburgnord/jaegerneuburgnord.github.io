// Ändere die Cache-Version, wenn du Updates bereitstellen möchtest
const CACHE_VERSION = 22;
const CACHE_NAME = `wiesen-karte-cache-v${CACHE_VERSION}`;

const filesToCache = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/leaflet.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/@tmcw/togeojson@4.5.0/dist/togeojson.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css',
  './styles.css',
  './js/utils.js',
  './js/map-config.js',
  './js/search.js',
  './js/location.js',
  './js/polygon.js',
  './js/kmz-export.js',
  './js/main.js',
  './manifest.json',
  './icon-192x192.png'
];

// Installation: Cache-Ressourcen speichern
self.addEventListener('install', event => {
  console.log('Service Worker wird installiert');
  
  // Force aktivieren (überspringt die Waiting-Phase)
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(cacheName)
      .then(cache => {
        console.log('Cache wird gefüllt');
        return cache.addAll(filesToCache);
      })
  );
});

// Aktivierung: Alte Caches löschen
self.addEventListener('activate', event => {
  console.log('Service Worker wird aktiviert');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(thisCacheName => {
          // Lösche alte Caches, die nicht mehr benötigt werden
          if (thisCacheName !== cacheName) {
            console.log('Alter Cache wird gelöscht:', thisCacheName);
            return caches.delete(thisCacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker übernimmt die Kontrolle über alle Clients');
      return self.clients.claim();
    })
  );
});

// Anfragen abfangen und aus dem Cache bedienen
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        
        // Ansonsten frisch laden und in Cache speichern
        return fetch(event.request).then(response => {
          // Skip cross-origin requests und nicht erfolgreiche responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Der Cache nimmt immer eine Kopie
          let responseToCache = response.clone();
          
          caches.open(cacheName)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});

// Nachricht vom Client empfangen
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
