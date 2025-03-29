// Variablen für Segment Anything Integration
let segmentAnythingMode = false;
let segmentationInProgress = false;
let segmentationMarker = null;

// Funktion zum Starten des Segment-Anything-Modus
function startSegmentAnything() {
    if (segmentAnythingMode) {
        stopSegmentAnything();
        return;
    }
    
    segmentAnythingMode = true;
    document.getElementById('start-segment').innerHTML = '<i class="fas fa-times"></i> Segmentierung abbrechen';
    document.getElementById('start-segment').style.backgroundColor = '#f44336';
    
    // Bayern Atlas Overlay aktivieren für bessere visuelle Erkennung von Flächen
    bayerAtlasOverlay.addTo(map);
    const bayernAtlasCheckbox = document.querySelector('input[type="checkbox"][name="' + L.Util.stamp(bayerAtlasOverlay) + '"]');
    if (bayernAtlasCheckbox) {
        bayernAtlasCheckbox.checked = true;
    }
    
    // Klick-Event hinzufügen
    map.on('click', triggerSegmentation);
    
    // Cursor ändern
    setSegmentationCursor(true);
    
    // Info anzeigen
    alert('Klicken Sie auf einen Punkt innerhalb der Fläche, die Sie segmentieren möchten. Die KI wird versuchen, die Grenzen automatisch zu erkennen.');
}

// Funktion zum Stoppen des Segment-Anything-Modus
function stopSegmentAnything() {
    segmentAnythingMode = false;
    document.getElementById('start-segment').innerHTML = '<i class="fas fa-magic"></i> Fläche erkennen';
    document.getElementById('start-segment').style.backgroundColor = '#4CAF50';
    
    map.off('click', triggerSegmentation);
    
    // Cursor zurücksetzen
    setSegmentationCursor(false);
    
    // Segmentierungsmarker entfernen
    if (segmentationMarker) {
        map.removeLayer(segmentationMarker);
        segmentationMarker = null;
    }
}

// Cursor für den Segmentierungsmodus setzen
function setSegmentationCursor(enable) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    if (enable) {
        // Fadenkreuz-Cursor für bessere Genauigkeit
        mapContainer.style.cursor = 'crosshair';
    } else {
        // Zurück zum Standard-Cursor
        mapContainer.style.cursor = '';
    }
}

// Funktion zum Auslösen der Segmentierung
function triggerSegmentation(e) {
    if (segmentationInProgress) {
        alert('Eine Segmentierung ist bereits im Gange. Bitte warten Sie.');
        return;
    }
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Marker setzen, um den Klickpunkt zu markieren
    if (segmentationMarker) {
        map.removeLayer(segmentationMarker);
    }
    
    segmentationMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'segmentation-marker',
            html: '<div class="pulsating-circle"></div>',
            iconSize: [20, 20]
        })
    }).addTo(map);
    
    // Status aktualisieren
    segmentationInProgress = true;
    
    // Lade-Indikator anzeigen
    showSegmentationLoading(true);
    
    // Segmentierung starten
    performSegmentation(lat, lng)
        .then(polygon => {
            // Segmentiertes Polygon erstellen
            createSegmentedPolygon(polygon);
        })
        .catch(error => {
            console.error('Fehler bei der Segmentierung:', error);
            alert('Bei der Segmentierung ist ein Fehler aufgetreten: ' + error.message);
        })
        .finally(() => {
            // Lade-Indikator ausblenden und Status zurücksetzen
            showSegmentationLoading(false);
            segmentationInProgress = false;
            
            // Marker entfernen
            if (segmentationMarker) {
                map.removeLayer(segmentationMarker);
                segmentationMarker = null;
            }
            
            // Segmentierungsmodus beenden
            stopSegmentAnything();
        });
}

// Lade-Indikator anzeigen/verbergen
function showSegmentationLoading(show) {
    let loadingEl = document.getElementById('segmentation-loading');
    
    if (show) {
        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'segmentation-loading';
            loadingEl.className = 'segmentation-loading';
            loadingEl.innerHTML = `
                <div class="loading-content">
                    <div class="spinner"></div>
                    <p>Segmentierung läuft...</p>
                </div>
            `;
            document.body.appendChild(loadingEl);
        }
        loadingEl.style.display = 'flex';
    } else if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// API-Aufruf zur Durchführung der Segmentierung
async function performSegmentation(lat, lng) {
    // Die aktuelle Kartenansicht erfassen
    const bounds = map.getBounds();
    const zoom = map.getZoom();
    
    // In einer echten Implementierung würden wir hier das aktuelle Satellitenbild und die 
    // Klickkoordinate an einen Server senden, der das Segment Anything Model ausführt
    
    // Für diese Demo simulieren wir die API-Antwort mit einer Verzögerung
    return new Promise((resolve) => {
        setTimeout(() => {
            // Simuliertes Polygon um den Klickpunkt
            const simulatedPolygon = generateSimulatedPolygon(lat, lng);
            resolve(simulatedPolygon);
        }, 2000); // 2 Sekunden Verzögerung zur Simulation
    });
}

// Hilfsfunktion zur Simulation eines Polygons
function generateSimulatedPolygon(centerLat, centerLng) {
    // Ein unregelmäßiges Polygon um den Mittelpunkt generieren
    const points = [];
    const numPoints = 8 + Math.floor(Math.random() * 6); // 8-13 Punkte
    const baseRadius = 0.001 + Math.random() * 0.002; // Zufälliger Radius (ca. 100-300m)
    
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        // Unregelmäßigeres Polygon durch Variation des Radius
        const radius = baseRadius * (0.8 + Math.random() * 0.4); 
        const lat = centerLat + radius * Math.sin(angle);
        const lng = centerLng + radius * Math.cos(angle);
        points.push([lat, lng]);
    }
    
    // Polygon schließen
    points.push([...points[0]]);
    
    return points;
}

// Funktion zum Erstellen eines Polygons aus der Segmentierung
function createSegmentedPolygon(points) {
    // Bestehende Polygon-Punkte löschen, falls vorhanden
    clearPolygonPoints();
    
    // Punkte zum Polygon hinzufügen (ohne den letzten Punkt, der ein Duplikat ist)
    for (let i = 0; i < points.length - 1; i++) {
        addPolygonPointAtCoords(points[i]);
    }
    
    // Fertiges Polygon erstellen
    finishPolygon();
    
    // Auf das Polygon zoomen
    if (polygonLayer) {
        map.fitBounds(polygonLayer.getBounds());
    }
    
    // Benachrichtigung anzeigen
    showNotification('Fläche erfolgreich erkannt! Sie können die Punkte nun bearbeiten oder das Polygon exportieren.');
}

// Funktion zum Anzeigen einer temporären Benachrichtigung
function showNotification(message, duration = 5000) {
    // Bestehende Benachrichtigung entfernen
    const existingNotification = document.getElementById('segmentation-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Neue Benachrichtigung erstellen
    const notification = document.createElement('div');
    notification.id = 'segmentation-notification';
    notification.className = 'notification';
    notification.innerHTML = `
        <div class="notification-content">
            <p>${message}</p>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Schließen-Button einrichten
    const closeButton = notification.querySelector('.notification-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            notification.remove();
        });
    }
    
    // Automatisch ausblenden nach der angegebenen Dauer
    setTimeout(() => {
        notification.classList.add('notification-hide');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, duration);
}

// Funktion zur Integration in die bestehende UI
function initSegmentAnything() {
    // UI-Element für Segment Anything erstellen
    const polygonButtonsContainer = document.querySelector('.polygon-buttons');
    if (!polygonButtonsContainer) {
        console.error('Polygon-Buttons-Container nicht gefunden');
        return;
    }
    
    // Button erstellen und einfügen
    const segmentButton = document.createElement('button');
    segmentButton.id = 'start-segment';
    segmentButton.innerHTML = '<i class="fas fa-magic"></i> Fläche erkennen';
    segmentButton.onclick = startSegmentAnything;
    
    // Nach dem "Polygon zeichnen"-Button einfügen
    const startPolygonButton = document.getElementById('start-polygon');
    if (startPolygonButton && startPolygonButton.parentNode) {
        startPolygonButton.parentNode.insertBefore(segmentButton, startPolygonButton.nextSibling);
    } else {
        // Fallback: Am Ende des Containers anfügen
        polygonButtonsContainer.appendChild(segmentButton);
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', function() {
    // Segment Anything Funktionalität initialisieren
    initSegmentAnything();
});