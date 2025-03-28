// Email-Funktionalität 
function sendRealEmail(to, subject, body, attachment) {
    // Diese Funktion würde in einer echten Server-Implementierung den E-Mail-Versand übernehmen
    // Hier nur als Platzhalter - erfordert eine Server-Komponente
    console.log(`Sende E-Mail an ${to}, Betreff: ${subject}`);
    
    // In einer realen Implementierung könnte hier ein POST-Request an einen Server-Endpunkt stehen
    // z.B. mit FormData, das die E-Mail-Daten und die Datei übermittelt
    
    /* Beispiel für Server-Implementierung (z.B. mit Express, NodeMailer):
    const formData = new FormData();
    formData.append('to', to);
    formData.append('subject', subject);
    formData.append('body', body);
    formData.append('attachment', attachment, 'Wiesen_Neuburg_Nord_Polygon.kmz');
    
    fetch('/api/send-mail', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        console.log('E-Mail gesendet:', data);
    })
    .catch(error => {
        console.error('Fehler beim Senden der E-Mail:', error);
    });
    */
}

// Funktion zur Berechnung der Polygonfläche in Quadratmetern
function calculatePolygonArea(latlngs) {
    // Verwendung der Leaflet-Funktion zur Flächenberechnung
    const tempPolygon = L.polygon(latlngs);
    return L.GeometryUtil.geodesicArea(tempPolygon.getLatLngs()[0]);
}

// Hilfsfunktion zur Berechnung der Polygonfläche (falls L.GeometryUtil nicht verfügbar ist)
L.GeometryUtil = L.extend(L.GeometryUtil || {}, {
    // Berechnet die Fläche eines Polygons in Quadratmetern
    geodesicArea: function(latLngs) {
        const pointsCount = latLngs.length;
        let area = 0.0;
        
        if (pointsCount > 2) {
            const RAD = Math.PI / 180;
            let p1, p2;
            
            for (let i = 0; i < pointsCount; i++) {
                p1 = latLngs[i];
                p2 = latLngs[(i + 1) % pointsCount];
                
                area += ((p2.lng - p1.lng) * RAD) * 
                        (2 + Math.sin(p1.lat * RAD) + Math.sin(p2.lat * RAD));
            }
            
            area = area * 6378137.0 * 6378137.0 / 2.0;
        }
        
        return Math.abs(area);
    }
});

// Funktion zum Extrahieren und Anzeigen der Cache-Version
async function displayCacheVersion() {
    // Überprüfen, ob Caches API verfügbar ist
    if ('caches' in window) {
        try {
            // Alle verfügbaren Caches abrufen
            const cacheNames = await caches.keys();
            
            // Nach dem Wiesen-Karte-Cache suchen
            const wiesenCaches = cacheNames.filter(name => name.startsWith('wiesen-karte-cache'));
            
            if (wiesenCaches.length > 0) {
                // Den neuesten Cache nehmen (falls mehrere existieren)
                const latestCache = wiesenCaches.sort().pop();
                
                // Versionsnummer extrahieren mit einem regulären Ausdruck
                const versionMatch = latestCache.match(/wiesen-karte-cache-v(\d+)/);
                
                if (versionMatch && versionMatch[1]) {
                    // Versionsnummer gefunden
                    const versionNumber = versionMatch[1];
                    
                    // Version im Header anzeigen
                    const headerElement = document.querySelector('.control-header span');
                    if (headerElement) {
                        headerElement.innerHTML = `Wiesen Neuburg Nord <small>(v${versionNumber})</small>`;
                    }
                }
            }
        } catch (error) {
            console.error('Fehler beim Abrufen der Cache-Version:', error);
        }
    }
}

// Funktion zum Konvertieren von What3Words-Links
function convertWhat3WordsToLinks(description) {
    if (!description) return description;
    
    // Split the description into lines
    const lines = description.includes('<br>') 
        ? description.split('<br>') 
        : [description];
    
    // Process each line
    const processedLines = lines.map(line => {
        // Check if the line contains a what3words URL
        if (line.toLowerCase().includes('what3words.com')) {
            // Find the URL using regex
            const urlRegex = /(https?:\/\/(?:www\.)?what3words\.com\/[^\s<]+)/gi;
            const matches = line.match(urlRegex);
            
            if (matches && matches.length > 0) {
                const url = matches[0];
                // Replace the URL with a clickable link
                return line.replace(url, `<a href="${url}" target="_blank">${url}</a>`);
            }
        }
        return line;
    });
    
    // Join the lines back together
    return processedLines.join('<br>');
}

// Toggle für alle Layer
function toggleAllLayers(show) {
    const group = [];
    for (const name in layers) {
        const checkbox = document.getElementById(name);
        checkbox.checked = show;
        if (show) {
            layers[name].addTo(map);
            group.push(layers[name]);
        } else {
            layers[name].removeFrom(map);
        }
    }
    if (show && group.length > 0) {
        const groupLayer = L.featureGroup(group);
        map.fitBounds(groupLayer.getBounds());
    }
}

// Funktion zum Einrichten von auf- und zuklappbaren Panels
function setupCollapsiblePanels() {
    // Hauptkontrollpanel
    const controlHeader = document.querySelector('.control-header');
    const controlContent = document.querySelector('.control-content');
    const toggleIcon = document.querySelector('.toggle-icon');
    
    controlHeader.addEventListener('click', function() {
        controlContent.classList.toggle('collapsed');
        toggleIcon.classList.toggle('fa-chevron-up');
        toggleIcon.classList.toggle('fa-chevron-down');
        controlHeader.classList.toggle('collapsed');
    });
    
    // Layer-Sektion
    const sectionHeaders = document.querySelectorAll('.section-header');
    
    sectionHeaders.forEach(header => {
        const icon = header.querySelector('i');
        const content = header.nextElementSibling;
        
        header.addEventListener('click', function() {
            content.classList.toggle('collapsed');
            icon.classList.toggle('fa-chevron-down');
            icon.classList.toggle('fa-chevron-up');
        });
    });
}