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
                if (typeof updatePolygonSelectOptions === 'function') {
                    updatePolygonSelectOptions();
                } else {
                    console.warn('Funktion updatePolygonSelectOptions nicht gefunden');
                }
            }
        });
    });
    
    // Tab-Umschaltung über externe Links ermöglichen
    window.switchToTab = function(tabId) {
        const tabElement = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (tabElement) {
            tabElement.click();
        } else {
            console.warn(`Tab mit ID ${tabId} nicht gefunden`);
        }
    };
});

// Funktion zum Aktualisieren der verfügbaren Polygone im Bearbeitungsmenü
function updatePolygonSelectOptions() {
    const select = document.getElementById('edit-polygon-select');
    if (!select) {
        console.warn('Element #edit-polygon-select nicht gefunden');
        return 0;
    }
    
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
    const loadButton = document.getElementById('load-polygon');
    if (loadButton) {
        loadButton.disabled = (polygonCount === 0);
    }
    
    return polygonCount;
}