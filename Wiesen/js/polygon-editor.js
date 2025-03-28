// Variablen für die Polygon-Bearbeitung
let currentEditingLayerName = null;
let originalPolygonFeature = null;
let originalLayer = null;
let isEditingExistingPolygon = false;

// Funktion zum Laden eines Polygons zur Bearbeitung
function loadPolygonForEditing() {
    const select = document.getElementById('edit-polygon-select');
    if (!select) {
        console.error("Select-Element für Polygon-Auswahl nicht gefunden");
        return;
    }
    
    const selectedOption = select.options[select.selectedIndex];
    
    if (!selectedOption || !selectedOption.value) {
        alert('Bitte wählen Sie ein Polygon aus.');
        return;
    }
    
    // Sicherstellen, dass wir im Polygon-Tab sind
    if (typeof switchToTab === 'function') {
        switchToTab('polygon-tab');
    }
    
    // Bisherige Polygon-Punkte löschen
    clearPolygonPoints();
    
    // Layernamen und Polygon-ID extrahieren
    const layerName = selectedOption.dataset.layerName;
    const polygonId = selectedOption.value;
    currentEditingLayerName = layerName;
    
    // Layer abrufen
    const layer = layers[layerName];
    if (!layer) {
        alert(`Layer "${layerName}" nicht gefunden.`);
        return;
    }
    
    let foundPolygon = false;
    
    // Polygon in diesem Layer finden
    layer.eachLayer(function(sublayer) {
        if (sublayer.feature && sublayer.feature.id === polygonId) {
            // Wir haben das zu bearbeitende Polygon gefunden
            originalLayer = sublayer;
            originalPolygonFeature = JSON.parse(JSON.stringify(sublayer.feature)); // Deep-Copy
            
            // Koordinaten extrahieren
            let coordinates;
            
            if (sublayer.feature.geometry.type === 'Polygon') {
                // Erstes Ring des Polygons (outer boundary) nehmen
                coordinates = sublayer.feature.geometry.coordinates[0];
            } else if (sublayer.feature.geometry.type === 'MultiPolygon') {
                // Erstes Polygon, ersten Ring nehmen
                coordinates = sublayer.feature.geometry.coordinates[0][0];
            }
            
            if (coordinates && coordinates.length > 0) {
                // Punkte umwandeln: GeoJSON hat [lng, lat], wir brauchen [lat, lng]
                coordinates.forEach(function(coord) {
                    // Letzten Punkt (Schließpunkt) überspringen
                    if (polygonPoints.length === 0 || 
                        polygonPoints[0][0] !== coord[1] || 
                        polygonPoints[0][1] !== coord[0]) {
                        addPolygonPointAtCoords([coord[1], coord[0]]);
                    }
                });
                
                // Polygon-Stil aufheben (nur wenn Punkte vorhanden sind)
                if (polygonPoints.length > 0) {
                    foundPolygon = true;
                    isEditingExistingPolygon = true;
                    
                    // Andere Layer ausblenden
                    hideAllLayersExcept(layerName);
                    
                    // Name und Beschreibung in die Felder setzen
                    if (sublayer.feature.properties) {
                        const nameField = document.getElementById('polygon-name');
                        if (nameField) {
                            nameField.value = sublayer.feature.properties.name || 'Bearbeitetes Polygon';
                        }
                        
                        const descField = document.getElementById('polygon-description');
                        if (descField) {
                            descField.value = sublayer.feature.properties.description || '';
                        }
                    }
                    
                    // Original-Layer verstecken
                    map.removeLayer(sublayer);
                    
                    // Neues Polygon zeichnen
                    if (typeof finishPolygon === 'function') {
                        finishPolygon();
                    }
                    
                    // Info anzeigen
                    alert('Polygon wurde zum Bearbeiten geladen. Sie können die Punkte verschieben, hinzufügen oder löschen.');
                }
            }
        }
    });
    
    if (!foundPolygon) {
        alert('Das ausgewählte Polygon konnte nicht geladen werden.');
    }
}

// Funktion zum Speichern eines bearbeiteten Polygons
function saveEditedPolygon(doExport = false) {
    if (!isEditingExistingPolygon || !originalPolygonFeature || !currentEditingLayerName) {
        return false; // Nichts zu speichern
    }
    
    // Aktuelle Koordinaten im GeoJSON-Format ([lng, lat]) erstellen
    const coordinates = polygonPoints.map(point => [point[1], point[0]]);
    
    // Sicherstellen, dass das Polygon geschlossen ist
    if (coordinates.length > 0 && 
        (coordinates[0][0] !== coordinates[coordinates.length-1][0] || 
         coordinates[0][1] !== coordinates[coordinates.length-1][1])) {
        coordinates.push([...coordinates[0]]);
    }
    
    // Neue Feature-Geometrie erstellen
    let newGeometry;
    if (originalPolygonFeature.geometry.type === 'Polygon') {
        newGeometry = {
            type: 'Polygon',
            coordinates: [coordinates]
        };
    } else if (originalPolygonFeature.geometry.type === 'MultiPolygon') {
        // Nur das erste Polygon ersetzen
        const newCoords = [...originalPolygonFeature.geometry.coordinates];
        newCoords[0] = [coordinates];
        newGeometry = {
            type: 'MultiPolygon',
            coordinates: newCoords
        };
    }
    
    // Name und Beschreibung abrufen
    const nameField = document.getElementById('polygon-name');
    const descField = document.getElementById('polygon-description');
    
    const name = nameField ? nameField.value : '';
    const description = descField ? descField.value : '';
    
    // What3Words aktualisieren oder hinzufügen
    let updatedDescription = description;
    
    // Wenn ein Export erwünscht ist, aktualisieren wir What3Words
    if (doExport && polygonLayer) {
        return updateWhat3WordsAndSave(newGeometry, name, updatedDescription);
    } else {
        // Sofort speichern ohne What3Words zu aktualisieren
        return completePolygonSave(newGeometry, name, updatedDescription, doExport);
    }
}

// Hilfsfunktion für das Aktualisieren von What3Words und anschließendes Speichern
function updateWhat3WordsAndSave(newGeometry, name, description) {
    // Mittelpunkt des Polygons berechnen für What3Words
    const bounds = polygonLayer.getBounds();
    const center = bounds.getCenter();
    
    // Versprechen, What3Words zu aktualisieren
    return new Promise((resolve) => {
        // Ältere What3Words-Einträge entfernen
        const lines = description.split('\n');
        const filteredLines = lines.filter(line => !line.toLowerCase().includes('what3words'));
        let updatedDescription = filteredLines.join('\n');
        
        // Neuen What3Words-Link abrufen und hinzufügen
        fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${center.lat},${center.lng}&language=de&format=json&key=YOUR_API_KEY`)
            .then(response => response.json())
            .then(data => {
                if (data && data.words) {
                    const w3wUrl = `https://what3words.com/${data.words}`;
                    
                    // Zur Beschreibung hinzufügen
                    if (updatedDescription) {
                        updatedDescription += '\n\n';
                    }
                    updatedDescription += `What3Words: ${w3wUrl}`;
                    
                    // What3Words-Feld aktualisieren
                    const w3wInput = document.getElementById('w3w-address');
                    if (w3wInput) {
                        w3wInput.value = data.words;
                    }
                }
                
                // Speichern mit aktualisierter Beschreibung
                const success = completePolygonSave(newGeometry, name, updatedDescription, true);
                resolve(success);
            })
            .catch(error => {
                console.error('Fehler beim Aktualisieren von What3Words:', error);
                
                // Fallback für Demos ohne API-Key
                const mockW3W = 'beispiel.demo.adresse';
                
                // Zur Beschreibung hinzufügen
                if (updatedDescription) {
                    updatedDescription += '\n\n';
                }
                updatedDescription += `What3Words: https://what3words.com/${mockW3W}`;
                
                // What3Words-Feld aktualisieren
                const w3wInput = document.getElementById('w3w-address');
                if (w3wInput) {
                    w3wInput.value = mockW3W;
                }
                
                // Speichern mit aktualisierter Beschreibung
                const success = completePolygonSave(newGeometry, name, updatedDescription, true);
                resolve(success);
            });
    });
}

// Hilfsfunktion, um das Speichern des Polygons abzuschließen
function completePolygonSave(newGeometry, name, description, doExport) {
    // Neues Feature erstellen
    const newFeature = {
        ...originalPolygonFeature,
        geometry: newGeometry,
        properties: {
            ...originalPolygonFeature.properties,
            name: name || originalPolygonFeature.properties.name || 'Bearbeitetes Polygon',
            description: description || originalPolygonFeature.properties.description || ''
        }
    };
    
    // Layer aktualisieren
    const layer = layers[currentEditingLayerName];
    if (layer && originalLayer) {
        // Original-Layer entfernen
        layer.removeLayer(originalLayer);
        
        // Neuen Layer hinzufügen
        const newLayer = L.geoJSON(newFeature, {
            style: {
                color: '#FF0000',
                weight: 3,
                opacity: 0.8,
                fillColor: '#FF0000',
                fillOpacity: 0.2
            },
            onEachFeature: function(feature, layer) {
                let popupText = feature.properties.name || 'Unbenannt';
                if (feature.properties.description) {
                    const processedDescription = typeof convertWhat3WordsToLinks === 'function' 
                        ? convertWhat3WordsToLinks(feature.properties.description)
                        : feature.properties.description;
                    popupText += "<br>" + processedDescription;
                }
                layer.bindPopup(popupText);
                
                // Index für die Suche
                const searchItem = {
                    name: feature.properties.name || 'Unbenannt',
                    description: feature.properties.description || '',
                    layer: layer,
                    parentLayer: currentEditingLayerName
                };
                searchIndex.push(searchItem);
            }
        });
        
        // Zur Karte hinzufügen
        newLayer.addTo(map);
        layer.addLayer(newLayer);
        
        // Wenn Export gewünscht ist, exportieren
        if (doExport) {
            // Beschreibungsfeld im Modal aktualisieren
            const descField = document.getElementById('polygon-description');
            if (descField) {
                descField.value = description;
            }
            
            // Exportieren
            if (typeof showEmailModal === 'function') {
                // Dialog öffnen
                showEmailModal();
            } else {
                console.error("Export-Funktion nicht gefunden");
            }
        }
        
        return true;
    }
    
    return false;
}

// Funktion zum Ausblenden aller Layer außer einem
function hideAllLayersExcept(exceptLayerName) {
    for (const layerName in layers) {
        if (layerName !== exceptLayerName) {
            // Checkbox deaktivieren
            const checkbox = document.getElementById(layerName);
            if (checkbox) {
                checkbox.checked = false;
            }
            
            // Layer von der Karte entfernen
            map.removeLayer(layers[layerName]);
        }
    }
}

// Hilfsfunktion zum Hinzufügen eines Punktes an bestimmten Koordinaten
function addPolygonPointAtCoords(coords) {
    if (!coords || coords.length < 2) {
        console.error("Ungültige Koordinaten zum Hinzufügen eines Punktes");
        return;
    }
    
    const lat = coords[0];
    const lng = coords[1];
    
    // Punkt zum Array hinzufügen
    polygonPoints.push([lat, lng]);
    
    // Marker erstellen
    const marker = L.marker([lat, lng], {
        draggable: true
    }).addTo(map);
    
    // Event für Marker-Drag
    marker.on('dragend', function(e) {
        const idx = polygonMarkers.indexOf(this);
        if (idx !== -1) {
            const newPos = this.getLatLng();
            polygonPoints[idx] = [newPos.lat, newPos.lng];
            if (typeof updatePolygonDisplay === 'function') {
                updatePolygonDisplay();
            }
        }
    });
    
    // Event für Marker-Klick (zum Entfernen)
    marker.on('contextmenu', function(e) {
        const idx = polygonMarkers.indexOf(this);
        if (idx !== -1) {
            map.removeLayer(this);
            polygonMarkers.splice(idx, 1);
            polygonPoints.splice(idx, 1);
            if (typeof updatePolygonDisplay === 'function') {
                updatePolygonDisplay();
            }
        }
    });
    
    // Marker zum Array hinzufügen
    polygonMarkers.push(marker);
    
    // Polygon aktualisieren
    if (typeof updatePolygonDisplay === 'function') {
        updatePolygonDisplay();
    }
    
    // Buttons aktivieren
    const clearBtn = document.getElementById('clear-polygon');
    if (clearBtn) {
        clearBtn.disabled = false;
    }
    
    const exportBtn = document.getElementById('export-polygon');
    if (exportBtn && polygonPoints.length >= 3) {
        exportBtn.disabled = false;
    }
}