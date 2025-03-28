// Variablen für Standortanzeige
let userMarker = null;
let accuracyCircle = null;
let watchId = null;
let isLocating = false;

// Funktion zum Anzeigen des aktuellen Standorts
function showCurrentLocation() {
    const locationButton = document.getElementById('location-button');
    
    if (!isLocating) {
        // Standort verfolgen starten
        if ('geolocation' in navigator) {
            locationButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Standort wird ermittelt...';
            
            watchId = navigator.geolocation.watchPosition(
                updateLocation,
                handleLocationError,
                { 
                    enableHighAccuracy: true, 
                    maximumAge: 10000,  // 10 Sekunden
                    timeout: 10000      // 10 Sekunden
                }
            );
            isLocating = true;
        } else {
            alert('Geolocation wird von Ihrem Browser nicht unterstützt');
        }
    } else {
        // Standortverfolgung beenden
        stopLocationTracking();
    }
}

// Standort auf der Karte aktualisieren
function updateLocation(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;
    
    // Marker entfernen, falls vorhanden
    if (userMarker) {
        map.removeLayer(userMarker);
    }
    if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
    }
    
    // Genauigkeitskreis erstellen
    accuracyCircle = L.circle([lat, lng], {
        radius: accuracy,
        className: 'accuracy-circle'
    }).addTo(map);
    
    // Benutzerdefinierten Marker erstellen
    const markerIcon = L.divIcon({
        className: 'user-marker',
        iconSize: [24, 24]
    });
    
    userMarker = L.marker([lat, lng], {
        icon: markerIcon,
        zIndexOffset: 1000
    }).addTo(map);
    
    // Karte auf Standort zentrieren (nur beim ersten Mal)
    const locationButton = document.getElementById('location-button');
    if (locationButton.innerHTML.includes('fa-spinner')) {
        map.setView([lat, lng], 17);
        locationButton.innerHTML = '<i class="fas fa-map-marker-alt"></i> Standort aktiv';
    }
}

// Fehlerbehandlung für Geolocation
function handleLocationError(error) {
    let errorMessage;
    
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = 'Standortzugriff verweigert';
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = 'Standort ist nicht verfügbar';
            break;
        case error.TIMEOUT:
            errorMessage = 'Zeitüberschreitung beim Abrufen des Standorts';
            break;
        case error.UNKNOWN_ERROR:
            errorMessage = 'Ein unbekannter Fehler ist aufgetreten';
            break;
    }
    
    alert('Standortfehler: ' + errorMessage);
    stopLocationTracking();
}

// Standortverfolgung beenden
function stopLocationTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
    
    if (userMarker) {
        map.removeLayer(userMarker);
        userMarker = null;
    }
    
    if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
        accuracyCircle = null;
    }
    
    isLocating = false;
    document.getElementById('location-button').innerHTML = '<i class="fas fa-map-marker-alt"></i> Standort anzeigen';
}