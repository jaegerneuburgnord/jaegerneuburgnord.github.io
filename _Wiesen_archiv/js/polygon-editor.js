// Variablen für die Polygon-Bearbeitung
let currentEditingLayerName = null;
let originalPolygonFeature = null;
let originalLayer = null;
let isEditingExistingPolygon = false;

function addPolygonPointInEditMode(e) {
    if (!isEditingExistingPolygon || polygonMarkers.length < 2) return;
    
    const newPoint = [e.latlng.lat, e.latlng.lng];
    
    // Finde die nächste Linie im Polygon
    let minDist = Infinity;
    let insertIdx = -1;
    
    for (let i = 0; i < polygonMarkers.length - 1; i++) {
        const p1 = polygonMarkers[i].getLatLng();
        const p2 = polygonMarkers[i + 1].getLatLng();
        
        // Berechne Abstand des Klicks zur Linie
        const dist = distanceToLine(e.latlng, p1, p2);
        
        if (dist < minDist) {
            minDist = dist;
            insertIdx = i + 1;
        }
    }
    
    // Auch den Abstand zur Linie vom letzten zum ersten Punkt prüfen
    const p1 = polygonMarkers[polygonMarkers.length - 1].getLatLng();
    const p2 = polygonMarkers[0].getLatLng();
    const dist = distanceToLine(e.latlng, p1, p2);
    
    if (dist < minDist) {
        minDist = dist;
        insertIdx = polygonMarkers.length;
    }
    
    // Punkt nur hinzufügen, wenn er nahe genug an einer Linie ist
    if (minDist < 0.001) { // ca. 100m in Grad
        // Punkt an der richtigen Position einfügen
        polygonPoints.splice(insertIdx, 0, newPoint);
        
        // Neuen Marker erstellen
        const marker = L.marker(newPoint, {
            draggable: true
        }).addTo(map);
        
        // Event für Marker-Drag
        marker.on('dragend', function(e) {
            const idx = polygonMarkers.indexOf(this);
            if (idx !== -1) {
                const newPos = this.getLatLng();
                polygonPoints[idx] = [newPos.lat, newPos.lng];
                updatePolygonDisplay();
            }
        });
        
        // Event für Marker-Klick (zum Entfernen)
        marker.on('contextmenu', function(e) {
            const idx = polygonMarkers.indexOf(this);
            if (idx !== -1 && polygonMarkers.length > 3) { // Mindestens 3 Punkte behalten
                map.removeLayer(this);
                polygonMarkers.splice(idx, 1);
                polygonPoints.splice(idx, 1);
                updatePolygonDisplay();
            }
        });
        
        // Marker an der richtigen Position einfügen
        polygonMarkers.splice(insertIdx, 0, marker);
        
        // Polygon aktualisieren
        updatePolygonDisplay();
    }
}

function setPolygonEditCursor(enable) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    if (enable) {
        // Crosshair-Cursor für bessere Genauigkeit
        mapContainer.style.cursor = 'crosshair';
    } else {
        // Zurück zum Standard-Cursor
        mapContainer.style.cursor = '';
    }
}

// Hilfsfunktion zur Berechnung des Abstands eines Punkts zu einer Linie
function distanceToLine(point, lineStart, lineEnd) {
    const x = point.lng;
    const y = point.lat;
    const x1 = lineStart.lng;
    const y1 = lineStart.lat;
    const x2 = lineEnd.lng;
    const y2 = lineEnd.lat;
    
    // Berechne den Abstand
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    
    if (len_sq != 0) param = dot / len_sq;
    
    let xx, yy;
    
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = x - xx;
    const dy = y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
}

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
                    // alert('Polygon wurde zum Bearbeiten geladen. Sie können die Punkte verschieben, hinzufügen oder löschen.');
                }
            }
        }
    });
    
    if (foundPolygon) {
        setPolygonEditCursor(true); // Cursor ändern
        map.on('click', addPolygonPointInEditMode); // Klick-Event für Punkt-Hinzufügen
    }

    if (!foundPolygon) {
        alert('Das ausgewählte Polygon konnte nicht geladen werden.');
    }
}

// Funktion zum Speichern eines bearbeiteten Polygons
function saveEditedPolygon(doExport = false) {
    if (!isEditingExistingPolygon) {
        console.warn("Kein Polygon im Bearbeitungsmodus");
        return false;
    }
    
    if (!originalPolygonFeature) {
        console.error("Originalpolygon fehlt");
        return false;
    }
    
    if (!currentEditingLayerName) {
        console.error("Layer-Name fehlt");
        return false;
    }
    
    // Prüfen, ob genügend Punkte vorhanden sind
    if (polygonPoints.length < 3) {
        alert('Das Polygon benötigt mindestens 3 Punkte.');
        return false;
    }
    
    try {
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
        } else {
            console.error("Unbekannter Geometrietyp:", originalPolygonFeature.geometry.type);
            return false;
        }
        
        // Name und Beschreibung abrufen
        const nameField = document.getElementById('polygon-name');
        const descField = document.getElementById('polygon-description');
        
        const name = nameField ? nameField.value : '';
        const description = descField ? descField.value : '';
        
        // What3Words für das aktualisierte Polygon hinzufügen
        let updatedDescription = description;
        if (doExport && polygonLayer) {
            try {
                // Entferne bestehende What3Words-Einträge
                const lines = updatedDescription.split('\n');
                const filteredLines = lines.filter(line => !line.toLowerCase().includes('what3words'));
                updatedDescription = filteredLines.join('\n');
                
               // Mittelpunkt des Polygons berechnen
               const bounds = polygonLayer.getBounds();
               const center = bounds.getCenter();
               
               useMockWhat3Words = true
               if (useMockWhat3Words) {
                // Generate mock what3words address
                const w3wUrl = `https://what3words.com/noch.nicht.implementiert`;
                
                if (updatedDescription) {
                    updatedDescription += '\n\n';
                }
                updatedDescription += `What3Words: ${w3wUrl}`;
                
                // What3Words-Feld aktualisieren
                const w3wInput = document.getElementById('w3w-address');
                if (w3wInput) {
                    w3wInput.value = "noch.nicht.implementiert";
                }
                
                // Feature speichern und exportieren
                return completePolygonSave(newGeometry, name, updatedDescription, doExport);
            } else {
               // API-Key für What3Words
               const apiKey = 'IPAZBM3Y';
               
               // Anfrage an die What3Words API senden
               return fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${center.lat},${center.lng}&language=de&format=json&key=${apiKey}`)
                   .then(response => {
                       if (!response.ok) {
                           throw new Error(`HTTP-Fehler: ${response.status}`);
                       }
                       return response.json();
                   })
                   .then(data => {
                       if (data && data.words) {
                           // W3W-Adresse zum Text hinzufügen
                           const w3wUrl = `https://what3words.com/${data.words}`;
                           
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
                       
                       // Feature speichern und exportieren
                       return completePolygonSave(newGeometry, name, updatedDescription, doExport);
                   })
                   .catch(error => {
                       console.error("Fehler bei der What3Words-API:", error);
                       // Trotz Fehler das Feature speichern
                       return completePolygonSave(newGeometry, name, updatedDescription, doExport);
                   });
                }
           } catch (error) {
               console.error("Fehler bei What3Words-Aktualisierung:", error);
           }
        }

        // Feature speichern und optional exportieren
        return completePolygonSave(newGeometry, name, updatedDescription, doExport);
    } catch (error) {
        console.error("Fehler beim Speichern des Polygons:", error);
        return false;
    }
}

// Hilfsfunktion zum Speichern des Polygons
function completePolygonSave(newGeometry, name, description, doExport) {
    try {
        // Sicherstellen, dass originalPolygonFeature vorhanden ist
        if (!originalPolygonFeature) {
            throw new Error("Originalpolygon fehlt");
        }
        
        // Eigenschaften abrufen mit Fallback
        const originalProperties = originalPolygonFeature.properties || {};
        
        // Neues Feature erstellen
        const newFeature = {
            ...originalPolygonFeature,
            geometry: newGeometry,
            properties: {
                ...originalProperties,
                name: name || originalProperties.name || 'Bearbeitetes Polygon',
                description: description || originalProperties.description || ''
            }
        };
        
        // Layer aktualisieren
        const layer = layers[currentEditingLayerName];
        if (!layer) {
            throw new Error(`Layer "${currentEditingLayerName}" nicht gefunden`);
        }
        
        if (!originalLayer) {
            throw new Error("Original-Layer-Referenz fehlt");
        }
        
        // Original-Layer entfernen
        try {
            layer.removeLayer(originalLayer);
        } catch (e) {
            console.warn("Konnte Original-Layer nicht entfernen:", e);
            // Fortfahren auch wenn das Entfernen fehlschlägt
        }
        
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
                    let processedDescription = feature.properties.description;
                    
                    // Links in der Beschreibung verarbeiten (falls verfügbar)
                    if (typeof convertWhat3WordsToLinks === 'function') {
                        processedDescription = convertWhat3WordsToLinks(processedDescription);
                    }
                    
                    popupText += "<br>" + processedDescription;
                }
                
                layer.bindPopup(popupText);
                
                // Index für die Suche
                searchIndex.push({
                    name: feature.properties.name || 'Unbenannt',
                    description: feature.properties.description || '',
                    layer: layer,
                    parentLayer: currentEditingLayerName
                });
            }
        });
        
        // Zur Karte hinzufügen
        newLayer.addTo(map);
        layer.addLayer(newLayer);
        
        // Wenn Export gewünscht ist, exportieren
        if (doExport) {
            // Beschreibungsfeld im Modal aktualisieren, falls nötig
            const descField = document.getElementById('polygon-description');
            if (descField && description) {
                descField.value = description;
            }
            
            // Exportdialog öffnen
            if (typeof showEmailModal === 'function') {
                showEmailModal();
            } else {
                console.error("Export-Funktion nicht gefunden");
            }
        }
        
        return true;
    } catch (error) {
        console.error("Fehler beim Fertigstellen des Polygon-Speicherns:", error);
        return false;
    }
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
            try {
                map.removeLayer(layers[layerName]);
            } catch (e) {
                // Ignorieren, falls Layer bereits entfernt oder nicht vorhanden
                console.warn(`Konnte Layer "${layerName}" nicht entfernen:`, e);
            }
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
    try {
        const marker = L.marker([lat, lng], {
            draggable: true
        }).addTo(map);
        
        // Event für Marker-Drag
        marker.on('dragend', function(e) {
            try {
                const idx = polygonMarkers.indexOf(this);
                if (idx !== -1) {
                    const newPos = this.getLatLng();
                    polygonPoints[idx] = [newPos.lat, newPos.lng];
                    if (typeof updatePolygonDisplay === 'function') {
                        updatePolygonDisplay();
                    }
                }
            } catch (err) {
                console.error("Fehler beim Marker-Verschieben:", err);
            }
        });
        
        // Event für Marker-Klick (zum Entfernen)
        marker.on('contextmenu', function(e) {
            try {
                const idx = polygonMarkers.indexOf(this);
                if (idx !== -1) {
                    map.removeLayer(this);
                    polygonMarkers.splice(idx, 1);
                    polygonPoints.splice(idx, 1);
                    if (typeof updatePolygonDisplay === 'function') {
                        updatePolygonDisplay();
                    }
                }
            } catch (err) {
                console.error("Fehler beim Marker-Entfernen:", err);
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
    } catch (error) {
        console.error("Fehler beim Erstellen des Markers:", error);
    }
}