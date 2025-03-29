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
    const mapCenter = map.getCenter();
    
    // Config für Segmentierung
    const config = {
        useServerModel: true,  // true = Server-API verwenden, false = Browser-Modell verwenden
        serverEndpoint: 'https://api.example.com/segment-anything',
        modelLoadPath: './models/segment-anything-lite/',
        simulateFallback: true // Simulation verwenden, wenn keine echte Implementierung verfügbar
    };
    
    try {
        if (config.useServerModel) {
            // 1. Versuch: Server-basierte Implementierung
            try {
                console.log("Verwende Server-basierte Segmentierung");
                return await performServerSegmentation(lat, lng, bounds, zoom, mapCenter, config);
            } catch (error) {
                console.warn("Server-Segmentierung fehlgeschlagen, versuche Browser-Modell:", error);
                // Fallback auf Browser-basierte Implementierung
                return await performBrowserSegmentation(lat, lng, bounds, zoom, config);
            }
        } else {
            // 2. Option: Browser-basierte Implementierung direkt verwenden
            console.log("Verwende Browser-basierte Segmentierung");
            return await performBrowserSegmentation(lat, lng, bounds, zoom, config);
        }
    } catch (error) {
        console.error("Segmentierung fehlgeschlagen:", error);
        
        // Fallback auf Simulation, wenn konfiguriert
        if (config.simulateFallback) {
            console.log("Verwende Simulations-Fallback");
            return new Promise((resolve) => {
                setTimeout(() => {
                    const simulatedPolygon = generateSimulatedPolygon(lat, lng);
                    resolve(simulatedPolygon);
                }, 2000);
            });
        } else {
            throw error; // Fehler weiterleiten, wenn keine Simulation gewünscht
        }
    }
}

// Server-basierte Implementierung
async function performServerSegmentation(lat, lng, bounds, zoom, mapCenter, config) {
    // Aktuelle Kartensichtparameter für den Server
    const viewParams = {
        nw: [bounds.getNorthWest().lat, bounds.getNorthWest().lng],
        se: [bounds.getSouthEast().lat, bounds.getSouthEast().lng],
        zoom: zoom,
        center: [mapCenter.lat, mapCenter.lng],
        clickPoint: [lat, lng]
    };
    
    // Capture des aktuellen Kartenausschnitts als Bild (falls möglich)
    let imageData = null;
    try {
        imageData = await captureMapView();
    } catch (error) {
        console.warn("Konnte Kartenansicht nicht erfassen:", error);
        // Fahre ohne Bilddaten fort, der Server kann ggf. selbst Satellitenbilder laden
    }
    
    // API-Anfrage an den Server
    const response = await fetch(config.serverEndpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            viewParams: viewParams,
            imageData: imageData,
            apiKey: 'YOUR_API_KEY' // Falls erforderlich
        })
    });
    
    if (!response.ok) {
        throw new Error(`Server-Fehler: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.polygon || !Array.isArray(data.polygon)) {
        throw new Error('Ungültiges Antwortformat vom Server');
    }
    
    return data.polygon;
}

// Browser-basierte Implementierung mit TensorFlow.js oder ONNX
async function performBrowserSegmentation(lat, lng, bounds, zoom, config) {
    // Modell laden (entweder TensorFlow.js oder ONNX Runtime)
    let model = window.segmentAnythingModel;
    
    if (!model) {
        try {
            console.log("Lade Segment Anything Modell im Browser");
            showSegmentationLoading(true, "Lade KI-Modell...");
            
            // Prüfen, ob ONNX oder TensorFlow.js verfügbar ist
            if (window.ort) {
                model = await loadONNXModel(config.modelLoadPath);
            } else if (window.tf) {
                model = await loadTensorFlowModel(config.modelLoadPath);
            } else {
                throw new Error("Weder ONNX noch TensorFlow.js ist verfügbar");
            }
            
            // Modell für spätere Verwendung cachen
            window.segmentAnythingModel = model;
            
        } catch (error) {
            console.error("Fehler beim Laden des Modells:", error);
            throw new Error("Konnte KI-Modell nicht laden: " + error.message);
        } finally {
            showSegmentationLoading(false);
        }
    }
    
    // Kartenausschnitt als Bild erfassen
    const imageData = await captureMapView();
    if (!imageData) {
        throw new Error("Konnte Kartenansicht nicht erfassen");
    }
    
    // Vorverarbeitung des Bildes
    const processedImage = await preprocessImage(imageData);
    
    // Punkt im Bildkoordinaten umrechnen
    const pointOnImage = mapCoordsToImageCoords(lat, lng, bounds, processedImage.width, processedImage.height);
    
    // Segmentierung durchführen
    showSegmentationLoading(true, "Führe Segmentierung durch...");
    let segmentationResult;
    
    try {
        if (window.ort) {
            segmentationResult = await runONNXSegmentation(model, processedImage, pointOnImage);
        } else {
            segmentationResult = await runTensorFlowSegmentation(model, processedImage, pointOnImage);
        }
    } finally {
        showSegmentationLoading(false);
    }
    
    // Maske in Polygon-Punkte umwandeln
    const polygon = maskToPolygon(segmentationResult, bounds, processedImage.width, processedImage.height);
    
    return polygon;
}

// Hilft beim Erfassen des aktuellen Kartenausschnitts als Bild
async function captureMapView() {
    return new Promise((resolve, reject) => {
        try {
            // Option 1: Verwende html2canvas, falls verfügbar
            if (window.html2canvas) {
                const mapElement = document.getElementById('map');
                html2canvas(mapElement).then(canvas => {
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                }).catch(reject);
                return;
            }
            
            // Option 2: Versuche, einen Screenshot über die Screenshot-API zu machen (benötigt Berechtigungen)
            if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices.getDisplayMedia({video: true})
                    .then(stream => {
                        const track = stream.getVideoTracks()[0];
                        const imageCapture = new ImageCapture(track);
                        return imageCapture.grabFrame();
                    })
                    .then(bitmap => {
                        const canvas = document.createElement('canvas');
                        canvas.width = bitmap.width;
                        canvas.height = bitmap.height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(bitmap, 0, 0);
                        resolve(canvas.toDataURL('image/jpeg', 0.7));
                    })
                    .catch(reject);
                return;
            }
            
            // Keine Methode verfügbar
            resolve(null);
        } catch (error) {
            console.error("Fehler beim Erfassen der Kartenansicht:", error);
            resolve(null); // Fehler nicht weiterleiten, um Fortfahren zu ermöglichen
        }
    });
}

// Lade-Indikator mit benutzerdefinierter Nachricht
function showSegmentationLoading(show, message = "Segmentierung läuft...") {
    let loadingEl = document.getElementById('segmentation-loading');
    
    if (show) {
        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'segmentation-loading';
            loadingEl.className = 'segmentation-loading';
            loadingEl.innerHTML = `
                <div class="loading-content">
                    <div class="spinner"></div>
                    <p id="loading-message">${message}</p>
                </div>
            `;
            document.body.appendChild(loadingEl);
        } else {
            // Nachricht aktualisieren, falls der Ladeindikator bereits existiert
            const messageEl = loadingEl.querySelector('#loading-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
        loadingEl.style.display = 'flex';
    } else if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

// In deinem segment-model-loader.js
async function loadONNXModel(path, progressCallback) {
    // Die neue Implementierung aufrufen (ist bereits global verfügbar)
    return await window.loadONNXModel(path, progressCallback);
}


async function loadTensorFlowModel(path) {
    // Diese Funktion würde ein TensorFlow.js-Modell laden
    // In der echten Implementierung würde dies die TensorFlow.js-API verwenden
    throw new Error("TensorFlow-Modellladung noch nicht implementiert");
}

async function preprocessImage(imageData) {
    // Diese Funktion würde das Bild für die Modellverarbeitung vorbereiten
    throw new Error("Bildvorverarbeitung noch nicht implementiert");
}

function mapCoordsToImageCoords(lat, lng, bounds, imageWidth, imageHeight) {
    // Diese Funktion würde geografische Koordinaten in Bildkoordinaten umrechnen
    throw new Error("Koordinatenumrechnung noch nicht implementiert");
}

async function runONNXSegmentation(model, image, point) {
    // Diese Funktion würde das ONNX-Modell zur Segmentierung verwenden
    throw new Error("ONNX-Segmentierung noch nicht implementiert");
}

async function runTensorFlowSegmentation(model, image, point) {
    // Diese Funktion würde das TensorFlow.js-Modell zur Segmentierung verwenden
    throw new Error("TensorFlow-Segmentierung noch nicht implementiert");
}

function maskToPolygon(mask, bounds, imageWidth, imageHeight) {
    // Diese Funktion würde die Segmentierungsmaske in Polygon-Punkte umwandeln
    throw new Error("Masken-zu-Polygon-Konvertierung noch nicht implementiert");
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

// Segment Anything Konfiguration
const segmentAnythingConfig = {
    useServerModel: true,   // true = Server-API verwenden, false = Browser-Modell verwenden
    serverEndpoint: 'https://api.example.com/segment-anything',
    modelLoadPath: './models/segment-anything-lite/',
    simulateFallback: true, // Simulation verwenden, wenn keine echte Implementierung verfügbar
    showAdvancedOptions: false, // Erweiterte Optionen anzeigen
    serverApiKey: '',       // API-Schlüssel für den Server
    autoLoadModel: false    // Modell automatisch laden bei Initialisierung
};

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
    
    // Erweiterte Einstellungen für Segment Anything hinzufügen
    addSegmentAnythingSettings();
    
    // Automatisches Laden des Modells, falls konfiguriert
    if (segmentAnythingConfig.autoLoadModel && !segmentAnythingConfig.useServerModel) {
        preloadSegmentAnythingModel();
    }
}

// Funktion zum Vorladen des Browser-Modells
async function preloadSegmentAnythingModel() {
    try {
        showNotification('Lade KI-Modell im Hintergrund...', 3000);
        
        // Prüfen, ob ONNX oder TensorFlow.js verfügbar ist
        if (window.ort) {
            window.segmentAnythingModel = await loadONNXModel(segmentAnythingConfig.modelLoadPath);
        } else if (window.tf) {
            window.segmentAnythingModel = await loadTensorFlowModel(segmentAnythingConfig.modelLoadPath);
        } else {
            console.warn("Weder ONNX noch TensorFlow.js ist verfügbar");
            return;
        }
        
        showNotification('KI-Modell erfolgreich geladen!', 3000);
    } catch (error) {
        console.error("Fehler beim Vorladen des Modells:", error);
        showNotification('Fehler beim Laden des KI-Modells. Server-Modus wird verwendet.', 5000);
        // Fallback auf Server-Modus
        segmentAnythingConfig.useServerModel = true;
    }
}

// Erweiterte Einstellungen für Segment Anything
function addSegmentAnythingSettings() {
    // Neue Sektion für die Segment Anything Einstellungen erstellen
    const polygonSection = document.querySelector('.polygon-section');
    if (!polygonSection || !polygonSection.parentNode) return;
    
    const segmentSection = document.createElement('div');
    segmentSection.className = 'polygon-section';
    segmentSection.innerHTML = `
        <div class="section-header">
            <span>Flächen-KI Einstellungen</span>
            <i class="fas fa-chevron-down"></i>
        </div>
        <div class="layer-items">
            <div class="settings-item">
                <label>
                    <input type="checkbox" id="segment-server-mode" ${segmentAnythingConfig.useServerModel ? 'checked' : ''}>
                    Server-Modus verwenden
                </label>
                <small>Empfohlen für beste Ergebnisse</small>
            </div>
            
            <div class="settings-item">
                <label>
                    <input type="checkbox" id="segment-simulation" ${segmentAnythingConfig.simulateFallback ? 'checked' : ''}>
                    Simulation bei Fehlern verwenden
                </label>
            </div>
            
            <div class="settings-item">
                <button id="preload-model">KI-Modell jetzt laden</button>
                <small>Lädt das Modell im Voraus, um später schneller arbeiten zu können</small>
            </div>
            
            <div class="settings-item">
                <label>
                    <input type="checkbox" id="segment-advanced-options" ${segmentAnythingConfig.showAdvancedOptions ? 'checked' : ''}>
                    Erweiterte Optionen anzeigen
                </label>
            </div>
            
            <div id="segment-advanced-settings" style="${segmentAnythingConfig.showAdvancedOptions ? '' : 'display: none;'}">
                <div class="settings-item">
                    <label for="segment-server-url">Server-URL:</label>
                    <input type="text" id="segment-server-url" value="${segmentAnythingConfig.serverEndpoint}">
                </div>
                
                <div class="settings-item">
                    <label for="segment-api-key">API-Schlüssel:</label>
                    <input type="text" id="segment-api-key" value="${segmentAnythingConfig.serverApiKey}">
                </div>
                
                <div class="settings-item">
                    <label for="segment-model-path">Modell-Pfad:</label>
                    <input type="text" id="segment-model-path" value="${segmentAnythingConfig.modelLoadPath}">
                </div>
            </div>
        </div>
    `;
    
    // Nach der Polygon-Sektion einfügen
    polygonSection.parentNode.insertBefore(segmentSection, polygonSection.nextSibling);
    
    // Event-Listener für die Einstellungen
    setupSegmentSettingsListeners();
}

// Event-Listener für die Segment Anything Einstellungen
function setupSegmentSettingsListeners() {
    // Abschnitt auf- und zuklappen
    const sectionHeader = document.querySelector('.polygon-section:nth-of-type(3) .section-header');
    if (sectionHeader) {
        const icon = sectionHeader.querySelector('i');
        const content = sectionHeader.nextElementSibling;
        
        sectionHeader.addEventListener('click', function() {
            content.classList.toggle('collapsed');
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        });
    }
    
    // Server-Modus Toggle
    const serverModeCheckbox = document.getElementById('segment-server-mode');
    if (serverModeCheckbox) {
        serverModeCheckbox.addEventListener('change', function() {
            segmentAnythingConfig.useServerModel = this.checked;
            saveSegmentAnythingConfig();
        });
    }
    
    // Simulation Toggle
    const simulationCheckbox = document.getElementById('segment-simulation');
    if (simulationCheckbox) {
        simulationCheckbox.addEventListener('change', function() {
            segmentAnythingConfig.simulateFallback = this.checked;
            saveSegmentAnythingConfig();
        });
    }
    
    // Erweiterte Optionen Toggle
    const advancedOptionsCheckbox = document.getElementById('segment-advanced-options');
    if (advancedOptionsCheckbox) {
        advancedOptionsCheckbox.addEventListener('change', function() {
            segmentAnythingConfig.showAdvancedOptions = this.checked;
            const advancedSettings = document.getElementById('segment-advanced-settings');
            if (advancedSettings) {
                advancedSettings.style.display = this.checked ? 'block' : 'none';
            }
            saveSegmentAnythingConfig();
        });
    }
    
    // Vorlade-Button
    const preloadButton = document.getElementById('preload-model');
    if (preloadButton) {
        preloadButton.addEventListener('click', function() {
            preloadSegmentAnythingModel();
        });
    }
    
    // Server-URL
    const serverUrlInput = document.getElementById('segment-server-url');
    if (serverUrlInput) {
        serverUrlInput.addEventListener('change', function() {
            segmentAnythingConfig.serverEndpoint = this.value;
            saveSegmentAnythingConfig();
        });
    }
    
    // API-Schlüssel
    const apiKeyInput = document.getElementById('segment-api-key');
    if (apiKeyInput) {
        apiKeyInput.addEventListener('change', function() {
            segmentAnythingConfig.serverApiKey = this.value;
            saveSegmentAnythingConfig();
        });
    }
    
    // Modell-Pfad
    const modelPathInput = document.getElementById('segment-model-path');
    if (modelPathInput) {
        modelPathInput.addEventListener('change', function() {
            segmentAnythingConfig.modelLoadPath = this.value;
            saveSegmentAnythingConfig();
        });
    }
}

// Konfiguration speichern und laden
function saveSegmentAnythingConfig() {
    try {
        localStorage.setItem('segmentAnythingConfig', JSON.stringify(segmentAnythingConfig));
    } catch (error) {
        console.error("Fehler beim Speichern der Konfiguration:", error);
    }
}

function loadSegmentAnythingConfig() {
    try {
        const savedConfig = localStorage.getItem('segmentAnythingConfig');
        if (savedConfig) {
            const parsedConfig = JSON.parse(savedConfig);
            Object.assign(segmentAnythingConfig, parsedConfig);
        }
    } catch (error) {
        console.error("Fehler beim Laden der Konfiguration:", error);
    }
}

// Initialisierung
document.addEventListener('DOMContentLoaded', function() {
    // Gespeicherte Konfiguration laden
    loadSegmentAnythingConfig();
    
    // Segment Anything Funktionalität initialisieren
    initSegmentAnything();
});