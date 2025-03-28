// Variablen für Polygon-Zeichnung
let drawingMode = false;
let polygonPoints = [];
let polygonMarkers = [];
let polygonLayer = null;
let tempPolygon = null;

// Funktionen für Polygon-Zeichnung
function startPolygonSelection() {
    if (drawingMode) {
        stopPolygonSelection();
        return;
    }
    
    drawingMode = true;
    document.getElementById('start-polygon').innerHTML = '<i class="fas fa-times"></i> Zeichnen beenden';
    document.getElementById('start-polygon').style.backgroundColor = '#f44336';
    
    // Bayern Atlas Overlay aktivieren
    bayerAtlasOverlay.addTo(map);
    const bayernAtlasCheckbox = document.querySelector('input[type="checkbox"][name="' + L.Util.stamp(bayerAtlasOverlay) + '"]');
    if (bayernAtlasCheckbox) {
        bayernAtlasCheckbox.checked = true;
    }
    
    // Klick-Event hinzufügen
    map.on('click', addPolygonPoint);
    
    // Info anzeigen
    alert('Klicken Sie auf die Karte, um Punkte für Ihr Polygon zu setzen. Beenden Sie den Zeichenmodus mit einem erneuten Klick auf den Button.');
}

function stopPolygonSelection() {
    drawingMode = false;
    document.getElementById('start-polygon').innerHTML = '<i class="fas fa-draw-polygon"></i> Polygon zeichnen';
    document.getElementById('start-polygon').style.backgroundColor = '#4CAF50';
    
    map.off('click', addPolygonPoint);
    
    if (polygonPoints.length >= 3) {
        // Ein geschlossenes Polygon erstellen
        finishPolygon();
    }
}

function addPolygonPoint(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
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
            updatePolygonDisplay();
        }
    });
    
    // Event für Marker-Klick (zum Entfernen)
    marker.on('contextmenu', function(e) {
        const idx = polygonMarkers.indexOf(this);
        if (idx !== -1) {
            map.removeLayer(this);
            polygonMarkers.splice(idx, 1);
            polygonPoints.splice(idx, 1);
            updatePolygonDisplay();
        }
    });
    
    // Marker zum Array hinzufügen
    polygonMarkers.push(marker);
    
    updatePolygonDisplay();
    
    // Buttons aktivieren
    document.getElementById('clear-polygon').disabled = false;
    if (polygonPoints.length >= 3) {
        document.getElementById('export-polygon').disabled = false;
    }
}

function updatePolygonDisplay() {
    // Text-Anzeige aktualisieren
    const pointsElement = document.getElementById('polygon-points');
    if (polygonPoints.length === 0) {
        pointsElement.textContent = 'Keine Punkte ausgewählt';
    } else {
        pointsElement.innerHTML = `<strong>${polygonPoints.length} Punkte:</strong><br>` + 
            polygonPoints.map((point, idx) => 
                `${idx+1}: [${point[0].toFixed(6)}, ${point[1].toFixed(6)}]`
            ).join('<br>');
    }
    
    // Temporäres Polygon aktualisieren
    if (tempPolygon) {
        map.removeLayer(tempPolygon);
    }
    
    if (polygonPoints.length >= 2) {
        tempPolygon = L.polyline(polygonPoints, {
            color: '#FF0000',
            weight: 2,
            opacity: 0.7,
            dashArray: '5, 10'
        }).addTo(map);
    }
    
    // Buttons aktualisieren
    document.getElementById('export-polygon').disabled = polygonPoints.length < 3;
    document.getElementById('clear-polygon').disabled = polygonPoints.length === 0;
}

function finishPolygon() {
    // Falls ein temporäres Polygon existiert, entfernen
    if (tempPolygon) {
        map.removeLayer(tempPolygon);
        tempPolygon = null;
    }
    
    // Falls bereits ein Polygon-Layer existiert, entfernen
    if (polygonLayer) {
        map.removeLayer(polygonLayer);
    }
    
    // Ein neues geschlossenes Polygon erstellen (erster und letzter Punkt identisch)
    let closedPoints = [...polygonPoints];
    if (closedPoints.length >= 3 && 
        (closedPoints[0][0] !== closedPoints[closedPoints.length-1][0] || 
         closedPoints[0][1] !== closedPoints[closedPoints.length-1][1])) {
        closedPoints.push([...closedPoints[0]]);
    }
    
    // Polygon-Layer erstellen und zur Karte hinzufügen
    polygonLayer = L.polygon(closedPoints, {
        color: '#FF0000',
        weight: 3,
        opacity: 0.8,
        fillColor: '#FF0000',
        fillOpacity: 0.2
    }).addTo(map);
    
    // Polygon-Fläche berechnen und anzeigen
    const area = calculatePolygonArea(closedPoints);
    const areaText = `${(area / 10000).toFixed(2)} Hektar (${area.toFixed(0)} m²)`;
    
    // Popup mit zusätzlichen Infos anzeigen
    const popupContent = `
        <div style="min-width: 200px;">
            <h4>Polygonfläche</h4>
            <p>${areaText}</p>
            <button onclick="preparePolygonExport()" style="width: 100%; padding: 5px; margin-top: 5px; cursor: pointer;">
                Als KMZ exportieren
            </button>
        </div>
    `;
    polygonLayer.bindPopup(popupContent);
    polygonLayer.openPopup();
    
    // Auf das Polygon zoomen
    map.fitBounds(polygonLayer.getBounds());
}

function clearPolygonPoints() {
    // Alle Marker entfernen
    for (const marker of polygonMarkers) {
        map.removeLayer(marker);
    }
    
    // Arrays leeren
    polygonMarkers = [];
    polygonPoints = [];
    
    // Temporäres Polygon entfernen
    if (tempPolygon) {
        map.removeLayer(tempPolygon);
        tempPolygon = null;
    }
    
    // Fertiges Polygon entfernen
    if (polygonLayer) {
        map.removeLayer(polygonLayer);
        polygonLayer = null;
    }
    
    // Anzeige aktualisieren
    updatePolygonDisplay();
}

function preparePolygonExport() {
    // Sicherstellen, dass mindestens 3 Punkte vorhanden sind
    if (polygonPoints.length < 3) {
        alert('Bitte setzen Sie mindestens 3 Punkte, um ein Polygon zu definieren.');
        return;
    }
    
    // Sicherstellen, dass BayernAtlas-Overlay aktiviert ist
    if (!map.hasLayer(bayerAtlasOverlay)) {
        bayerAtlasOverlay.addTo(map);
        alert('Bayern Atlas Overlay wurde aktiviert, um Flurstücke anzuzeigen.');
    }
    
    // KMZ-Export durchführen
    createAndExportKMZ();
}