// Tab-Wechsel-Funktionalität
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Tab-Wechsel-Event für jede Tab-Schaltfläche
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Aktiven Tab hervorheben
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Aktiven Tab-Inhalt anzeigen
            const tabId = this.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
            
            // Spezielle Aktionen für bestimmte Tabs
            if (tabId === 'polygon-tab') {
                // Tab für Polygon-Tools wird aktiviert
                updatePolygonSelectOptions();
            }
        });
    });
    
    // Tab-Umschaltung über externe Links ermöglichen
    window.switchToTab = function(tabId) {
        document.querySelector(`.tab-button[data-tab="${tabId}"]`).click();
    };
});

// Funktion zum Aktualisieren der verfügbaren Polygone im Bearbeitungsmenü
function updatePolygonSelectOptions() {
    const select = document.getElementById('edit-polygon-select');
    
    // Zurücksetzen der Optionen
    select.innerHTML = '<option value="">-- Polygon auswählen --</option>';
    
    // Anzahl der gefundenen Polygone
    let polygonCount = 0;
    
    // Für jede KMZ-Ebene prüfen
    for (const layerName in layers) {
        const layer = layers[layerName];
        
        // Prüfen, ob diese Ebene Polygone enthält
        if (layer) {
            layer.eachLayer(function(sublayer) {
                // Ist es ein Polygon oder ein Multipolygon?
                if (sublayer.feature && 
                    (sublayer.feature.geometry.type === 'Polygon' || 
                     sublayer.feature.geometry.type === 'MultiPolygon')) {
                    
                    // Eindeutige ID generieren oder aus Feature nehmen
                    const id = sublayer.feature.id || `polygon-${layerName}-${polygonCount}`;
                    sublayer.feature.id = id; // ID speichern, falls sie nicht existiert
                    
                    // Name des Polygons ermitteln
                    const name = sublayer.feature.properties.name || `Polygon in ${layerName}`;
                    
                    // Option hinzufügen
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = name;
                    option.dataset.layerName = layerName;
                    select.appendChild(option);
                    
                    polygonCount++;
                }
            });
        }
    }
    
    // Meldung, wenn keine Polygone gefunden wurden
    if (polygonCount === 0) {
        const option = document.createElement('option');
        option.disabled = true;
        option.textContent = 'Keine Polygone verfügbar';
        select.appendChild(option);
    }
    
    // Button aktivieren oder deaktivieren
    document.getElementById('load-polygon').disabled = (polygonCount === 0);
    
    return polygonCount;
}