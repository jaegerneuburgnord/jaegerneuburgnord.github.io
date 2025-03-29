// UI für das Testen von Segment Anything Modellen

// Erweiterte Einstellungen für Segment Anything
function addModelTestingUI() {
    // Neue Sektion für die Modellauswahl erstellen
    const segmentSection = document.querySelector('.polygon-section:nth-of-type(3)');
    if (!segmentSection || !segmentSection.parentNode) return;
    
    const modelTestSection = document.createElement('div');
    modelTestSection.className = 'polygon-section';
    modelTestSection.innerHTML = `
        <div class="section-header">
            <span>Modell-Test-Werkzeug</span>
            <i class="fas fa-chevron-down"></i>
        </div>
        <div class="layer-items model-test-container">
            <div class="model-selection">
                <label for="model-selector">Verfügbare Modelle:</label>
                <select id="model-selector" class="model-dropdown">
                    <option value="">-- Modell auswählen --</option>
                </select>
            </div>
            
            <div class="model-info" id="model-info">
                <p>Kein Modell ausgewählt</p>
            </div>
            
            <div class="model-actions">
                <button id="load-model-btn" disabled>Modell laden</button>
                <button id="test-model-btn" disabled>Modell testen</button>
            </div>
            
            <div class="model-status">
                <div class="status-indicator">
                    <div class="model-loading-progress" id="model-loading-progress"></div>
                    <span id="loading-status">Bereit</span>
                </div>
            </div>
            
            <div class="test-results" id="test-results" style="display: none;">
                <h4>Testergebnisse</h4>
                <div class="result-metrics">
                    <div class="metric">
                        <span class="metric-label">Ladezeit:</span>
                        <span class="metric-value" id="load-time">-</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Inferenzzeit:</span>
                        <span class="metric-value" id="inference-time">-</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Speichernutzung:</span>
                        <span class="metric-value" id="memory-usage">-</span>
                    </div>
                </div>
                <div class="visualization" id="result-visualization">
                    <!-- Hier wird das Segmentierungsergebnis visualisiert -->
                </div>
            </div>
            
            <div class="comparison-tool" style="display: none;">
                <h4>Modellvergleich</h4>
                <table class="comparison-table">
                    <thead>
                        <tr>
                            <th>Modell</th>
                            <th>Ladezeit</th>
                            <th>Inferenzzeit</th>
                            <th>Genauigkeit</th>
                        </tr>
                    </thead>
                    <tbody id="comparison-body">
                        <!-- Hier werden Vergleichsdaten eingefügt -->
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    // Nach der Segmentierungssektion einfügen
    segmentSection.parentNode.insertBefore(modelTestSection, segmentSection.nextSibling);
    
    // Auklappbare Funktionalität hinzufügen
    const header = modelTestSection.querySelector('.section-header');
    const content = modelTestSection.querySelector('.layer-items');
    const icon = header.querySelector('i');
    
    header.addEventListener('click', function() {
        content.classList.toggle('collapsed');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
        
        // Wenn geöffnet, Modellliste aktualisieren
        if (!content.classList.contains('collapsed')) {
            updateModelSelector();
        }
    });
    
    // Event-Listener für UI-Elemente
    setupModelTestUIListeners();
}

// Event-Listener für Modell-Test-UI-Elemente
function setupModelTestUIListeners() {
    // Modellauswahl
    const modelSelector = document.getElementById('model-selector');
    if (modelSelector) {
        modelSelector.addEventListener('change', handleModelSelection);
    }
    
    // Modell laden Button
    const loadModelBtn = document.getElementById('load-model-btn');
    if (loadModelBtn) {
        loadModelBtn.addEventListener('click', handleModelLoad);
    }
    
    // Modell testen Button
    const testModelBtn = document.getElementById('test-model-btn');
    if (testModelBtn) {
        testModelBtn.addEventListener('click', handleModelTest);
    }
}

// Modellauswahl aktualisieren
function updateModelSelector() {
    const modelManager = window.segmentAnythingModelManager;
    if (!modelManager) {
        console.error("Modellmanager nicht gefunden");
        return;
    }
    
    const modelSelector = document.getElementById('model-selector');
    if (!modelSelector) return;
    
    // Aktuellen Wert speichern
    const currentValue = modelSelector.value;
    
    // Alle Optionen außer der ersten entfernen
    while (modelSelector.options.length > 1) {
        modelSelector.remove(1);
    }
    
    // Verfügbare Modelle abrufen und Optionen hinzufügen
    const availableModels = modelManager.listAvailableModels();
    for (const [modelId, modelInfo] of Object.entries(availableModels)) {
        const option = document.createElement('option');
        option.value = modelId;
        
        // Status des Modells anzeigen
        const status = modelManager.getModelStatus(modelId);
        const statusText = status === 'loaded' ? ' (Geladen)' : 
                         status === 'loading' ? ' (Wird geladen...)' : 
                         status === 'error' ? ' (Fehler)' : '';
        
        option.textContent = `${modelInfo.name}${statusText}`;
        modelSelector.appendChild(option);
    }
    
    // Vorherigen Wert wiederherstellen, wenn möglich
    if (currentValue) {
        modelSelector.value = currentValue;
    }
    
    // Modellinfo aktualisieren
    handleModelSelection();
}

// Handler für Modellauswahl
function handleModelSelection() {
    const modelSelector = document.getElementById('model-selector');
    const modelInfoEl = document.getElementById('model-info');
    const loadModelBtn = document.getElementById('load-model-btn');
    const testModelBtn = document.getElementById('test-model-btn');
    
    if (!modelSelector || !modelInfoEl || !loadModelBtn || !testModelBtn) return;
    
    const selectedModelId = modelSelector.value;
    
    if (!selectedModelId) {
        modelInfoEl.innerHTML = '<p>Kein Modell ausgewählt</p>';
        loadModelBtn.disabled = true;
        testModelBtn.disabled = true;
        return;
    }
    
    const modelManager = window.segmentAnythingModelManager;
    const availableModels = modelManager.listAvailableModels();
    const modelInfo = availableModels[selectedModelId];
    
    if (!modelInfo) {
        modelInfoEl.innerHTML = '<p>Modellinformationen nicht verfügbar</p>';
        loadModelBtn.disabled = true;
        testModelBtn.disabled = true;
        return;
    }
    
    // Modellinfos anzeigen
    modelInfoEl.innerHTML = `
        <div class="model-detail">
            <p><strong>${modelInfo.name}</strong></p>
            <p>${modelInfo.description}</p>
            <p><strong>Typ:</strong> ${modelInfo.type.toUpperCase()}</p>
            <p><strong>Größe:</strong> ${modelInfo.size}</p>
            <p><strong>Dateien:</strong> ${modelInfo.files.join(', ')}</p>
            <p><strong>Pfad:</strong> ${modelInfo.path}</p>
        </div>
    `;
    
    // Buttons je nach Modellstatus aktivieren/deaktivieren
    const modelStatus = modelManager.getModelStatus(selectedModelId);
    
    if (modelStatus === 'loaded') {
        loadModelBtn.disabled = true;
        loadModelBtn.textContent = 'Modell bereits geladen';
        testModelBtn.disabled = false;
    } else if (modelStatus === 'loading') {
        loadModelBtn.disabled = true;
        loadModelBtn.textContent = 'Wird geladen...';
        testModelBtn.disabled = true;
    } else {
        loadModelBtn.disabled = false;
        loadModelBtn.textContent = 'Modell laden';
        testModelBtn.disabled = true;
    }
}

// Handler für Modell laden Button
async function handleModelLoad() {
    const modelSelector = document.getElementById('model-selector');
    const loadModelBtn = document.getElementById('load-model-btn');
    const loadingStatus = document.getElementById('loading-status');
    const progressBar = document.getElementById('model-loading-progress');
    
    if (!modelSelector || !loadModelBtn || !loadingStatus || !progressBar) return;
    
    const selectedModelId = modelSelector.value;
    if (!selectedModelId) return;
    
    const modelManager = window.segmentAnythingModelManager;
    
    // UI aktualisieren
    loadModelBtn.disabled = true;
    loadModelBtn.textContent = 'Wird geladen...';
    loadingStatus.textContent = 'Modell wird geladen...';
    progressBar.style.width = '0%';
    
    try {
        // Fortschrittsanzeige
        const progressCallback = (progress, modelName) => {
            progressBar.style.width = `${progress}%`;
            loadingStatus.textContent = `${modelName} wird geladen... ${Math.round(progress)}%`;
        };
        
        // Ladezeit messen
        const startTime = performance.now();
        
        // Modell laden
        await modelManager.loadModel(selectedModelId, progressCallback);
        
        // Ladezeit berechnen
        const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
        
        // UI aktualisieren
        loadingStatus.textContent = `Modell erfolgreich geladen (${loadTime}s)`;
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#4CAF50';
        
        // Ladezeit anzeigen
        document.getElementById('load-time').textContent = `${loadTime}s`;
        
        // Modellauswahl aktualisieren
        updateModelSelector();
        
    } catch (error) {
        console.error("Fehler beim Laden des Modells:", error);
        
        // UI für Fehler aktualisieren
        loadingStatus.textContent = `Fehler: ${error.message}`;
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = '#f44336';
        
        // Modellauswahl aktualisieren
        updateModelSelector();
    }
}

// Handler für Modell testen Button
async function handleModelTest() {
    const modelSelector = document.getElementById('model-selector');
    const testModelBtn = document.getElementById('test-model-btn');
    const loadingStatus = document.getElementById('loading-status');
    const testResults = document.getElementById('test-results');
    const visualization = document.getElementById('result-visualization');
    
    if (!modelSelector || !testModelBtn || !loadingStatus || !testResults || !visualization) return;
    
    const selectedModelId = modelSelector.value;
    if (!selectedModelId) return;
    
    const modelManager = window.segmentAnythingModelManager;
    
    // UI aktualisieren
    testModelBtn.disabled = true;
    loadingStatus.textContent = 'Segmentierung wird durchgeführt...';
    testResults.style.display = 'block';
    
    try {
        // Aktives Modell setzen
        modelManager.setActiveModel(selectedModelId);
        
        // Testbild generieren (Platzhalter)
        const testImageData = 'dummy-image-data';
        
        // Testpunkte definieren (Platzhalter)
        const testPointPrompts = [{ x: 0.5, y: 0.5, label: 1 }];
        
        // Inferenzzeit messen
        const startTime = performance.now();
        
        // Segmentierung durchführen
        const segmentationResult = await modelManager.segmentImage(testImageData, testPointPrompts);
        
        // Inferenzzeit berechnen
        const inferenceTime = ((performance.now() - startTime) / 1000).toFixed(2);
        
        // Speichernutzung abschätzen (wenn verfügbar)
        let memoryUsage = 'Nicht verfügbar';
        if (window.performance && window.performance.memory) {
            memoryUsage = `${Math.round(window.performance.memory.usedJSHeapSize / (1024 * 1024))} MB`;
        }
        
        // Ergebnisse anzeigen
        document.getElementById('inference-time').textContent = `${inferenceTime}s`;
        document.getElementById('memory-usage').textContent = memoryUsage;
        
        // Visualisierung (Platzhalter)
        visualization.innerHTML = `
            <div class="result-canvas">
                <svg width="300" height="300" viewBox="0 0 1 1" style="border: 1px solid #ccc; background-color: #f9f9f9;">
                    <polygon points="${segmentationResult.map(p => `${p[0]},${p[1]}`).join(' ')}" 
                             fill="rgba(0, 128, 255, 0.3)" 
                             stroke="rgba(0, 128, 255, 0.8)" 
                             stroke-width="0.01" />
                    <circle cx="0.5" cy="0.5" r="0.02" fill="red" />
                </svg>
                <div class="visualization-legend">
                    <p><span style="color: red;">●</span> Klickpunkt</p>
                    <p><span style="color: rgba(0, 128, 255, 0.8);">■</span> Segmentiertes Gebiet</p>
                </div>
            </div>
        `;
        
        // UI aktualisieren
        loadingStatus.textContent = 'Segmentierung abgeschlossen';
        testModelBtn.disabled = false;
        
    } catch (error) {
        console.error("Fehler bei der Segmentierung:", error);
        
        // UI für Fehler aktualisieren
        loadingStatus.textContent = `Fehler: ${error.message}`;
        testModelBtn.disabled = false;
        
        // Einfache Fehlermeldung in der Visualisierung anzeigen
        visualization.innerHTML = `
            <div class="error-message">
                <p><i class="fas fa-exclamation-triangle"></i> Fehler bei der Segmentierung</p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Modell mit dem aktuellen Kartenausschnitt testen
async function testModelWithMapView() {
    const modelSelector = document.getElementById('model-selector');
    if (!modelSelector || !modelSelector.value) {
        alert('Bitte wählen Sie zuerst ein Modell aus und laden Sie es.');
        return;
    }
    
    const modelManager = window.segmentAnythingModelManager;
    const modelId = modelSelector.value;
    
    // Prüfen, ob das Modell geladen ist
    if (modelManager.getModelStatus(modelId) !== 'loaded') {
        alert('Das ausgewählte Modell ist nicht geladen. Bitte laden Sie es zuerst.');
        return;
    }
    
    try {
        // Kartenansicht erfassen
        const mapView = await captureMapView();
        if (!mapView) {
            alert('Konnte die Kartenansicht nicht erfassen. Bitte verwenden Sie einen neueren Browser oder aktivieren Sie die erforderlichen Berechtigungen.');
            return;
        }
        
        // Mitte der Karte als Klickpunkt verwenden
        const center = map.getCenter();
        const testPoint = { 
            x: 0.5, // Bildmitte horizontal
            y: 0.5, // Bildmitte vertikal
            label: 1,
            mapCoords: [center.lat, center.lng]
        };
        
        // Hinweis anzeigen
        showNotification('Segmentierung der aktuellen Kartenansicht wird durchgeführt...', 0);
        
        // Modell als aktiv setzen
        modelManager.setActiveModel(modelId);
        
        // Segmentierung durchführen
        const segmentationResult = await modelManager.segmentImage(mapView, [testPoint]);
        
        // Segmentiertes Polygon in der Karte anzeigen
        displaySegmentationOnMap(segmentationResult, testPoint.mapCoords);
        
        // Benachrichtigung aktualisieren
        showNotification('Segmentierung abgeschlossen. Polygon zur Karte hinzugefügt.', 5000);
        
    } catch (error) {
        console.error("Fehler bei der Kartenansicht-Segmentierung:", error);
        showNotification(`Fehler bei der Segmentierung: ${error.message}`, 5000);
    }
}

// Segmentierungsergebnis auf der Karte anzeigen
function displaySegmentationOnMap(segmentationResult, centerPoint) {
    if (!segmentationResult || !segmentationResult.length) {
        console.error("Keine Segmentierungsergebnisse zum Anzeigen");
        return;
    }
    
    // Bestehende Punkte löschen
    clearPolygonPoints();
    
    // Schätzung der tatsächlichen Koordinaten basierend auf dem Zentrum
    // und relativer Position der Punkte im normalisierten Raum [0,1]
    
    // Vereinfachte Annahme: die segmentierten Punkte sind relativ zum Zentrum
    // Um eine echte Implementierung zu erstellen, müssten wir die relativen Koordinaten
    // basierend auf dem Kartenmaßstab und den Grenzen umrechnen
    
    const bounds = map.getBounds();
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();
    const width = se.lng - nw.lng;
    const height = nw.lat - se.lat;
    
    // Punkte zum Polygon hinzufügen
    for (const point of segmentationResult) {
        // Relative Koordinaten [0,1] in Karten-Koordinaten umrechnen
        const lat = nw.lat - (point[1] - 0.5) * height;
        const lng = nw.lng + (point[0] - 0.5) * width;
        
        addPolygonPointAtCoords([lat, lng]);
    }
    
    // Fertiges Polygon anzeigen
    finishPolygon();
    
    // Auf das Polygon zoomen, aber nicht zu weit
    if (polygonLayer) {
        map.fitBounds(polygonLayer.getBounds(), {
            padding: [50, 50],
            maxZoom: map.getZoom() // Aktuellen Zoom beibehalten
        });
    }
}

// Modell-Test-Werkzeug initialisieren
document.addEventListener('DOMContentLoaded', function() {
    // Modell-Test-UI hinzufügen, wenn der DOM geladen ist
    setTimeout(() => {
        addModelTestingUI();
    }, 500);
});

// Styles für das Modell-Test-Werkzeug
function addModelTestStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .model-test-container {
            padding: 10px;
        }
        
        .model-selection {
            margin-bottom: 15px;
        }
        
        .model-dropdown {
            width: 100%;
            padding: 8px;
            margin-top: 5px;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        
        .model-detail {
            background-color: #f9f9f9;
            padding: 10px;
            border-radius: 4px;
            font-size: 0.9em;
            margin-bottom: 15px;
            border-left: 3px solid #4CAF50;
        }
        
        .model-detail p {
            margin: 5px 0;
        }
        
        .model-actions {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
        }
        
        .model-actions button {
            flex: 1;
        }
        
        .status-indicator {
            background-color: #f0f0f0;
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 15px;
            position: relative;
            height: 20px;
            display: flex;
            align-items: center;
        }
        
        .model-loading-progress {
            position: absolute;
            left: 0;
            top: 0;
            height: 100%;
            width: 0%;
            background-color: #4CAF50;
            opacity: 0.3;
            border-radius: 4px;
            transition: width 0.3s ease;
        }
        
        #loading-status {
            position: relative;
            z-index: 1;
        }
        
        .result-metrics {
            display: flex;
            flex-wrap: wrap;
            gap: 15px;
            margin-bottom: 15px;
        }
        
        .metric {
            background-color: #f0f0f0;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 0.9em;
        }
        
        .metric-label {
            font-weight: bold;
            margin-right: 5px;
        }
        
        .result-canvas {
            text-align: center;
            margin: 15px 0;
        }
        
        .visualization-legend {
            font-size: 0.8em;
            display: flex;
            justify-content: center;
            gap: 15px;
            margin-top: 5px;
        }
        
        .error-message {
            padding: 15px;
            background-color: #ffebee;
            border-left: 4px solid #f44336;
            margin: 15px 0;
        }
        
        .error-message i {
            color: #f44336;
            margin-right: 5px;
        }
        
        .comparison-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        
        .comparison-table th, .comparison-table td {
            padding: 8px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        
        .comparison-table th {
            background-color: #f5f5f5;
            font-weight: bold;
        }
    `;
    document.head.appendChild(style);
}

// Styles beim Laden der Seite hinzufügen
document.addEventListener('DOMContentLoaded', function() {
    addModelTestStyles();
});