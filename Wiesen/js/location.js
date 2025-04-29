// -------------------- Globale Variablen --------------------
let userMarker = null;
let accuracyCircle = null;
let watchId = null;
let isLocating = false;

// -------------------- Haupt-Toggle --------------------
function toggleLocationTracking() {
  if (isLocating) {
    stopLocationTracking();
  } else {
    startLocationTracking();
  }
}

// -------------------- Start --------------------
function startLocationTracking() {
  if (watchId) return;                       // läuft schon
  const locationButton = document.getElementById('location-button');
  locationButton.innerHTML =
    '<i class="fas fa-crosshairs fa-spin"></i> Tracking…';

  watchId = navigator.geolocation.watchPosition(
    updateLocation,
    err => {
      console.warn(err);                     // nur loggen, nicht stoppen
      setTimeout(() => {
        if (!watchId) startLocationTracking();
      }, 5000);                              // nach 5 s nochmal versuchen
    },
    { enableHighAccuracy: true, maximumAge: 0 } // kein Timeout
  );
  isLocating = true;
}

// -------------------- Stop --------------------
function stopLocationTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }

  if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
  if (accuracyCircle) { map.removeLayer(accuracyCircle); accuracyCircle = null; }

  isLocating = false;
  document.getElementById('location-button').innerHTML =
    '<i class="fas fa-map-marker-alt"></i> Standort anzeigen';
}

// -------------------- Positions-Callback --------------------
function updateLocation(position) {
  const { latitude: lat, longitude: lng, accuracy } = position.coords;

  if (userMarker) map.removeLayer(userMarker);
  if (accuracyCircle) map.removeLayer(accuracyCircle);

  accuracyCircle = L.circle([lat, lng], {
    radius: accuracy,
    className: 'accuracy-circle'
  }).addTo(map);

  const markerIcon = L.divIcon({ className: 'user-marker', iconSize: [24, 24] });
  userMarker = L.marker([lat, lng], { icon: markerIcon, zIndexOffset: 1000 })
                .addTo(map);

  if (map.getZoom() < 16) map.setView([lat, lng], 17);
}
