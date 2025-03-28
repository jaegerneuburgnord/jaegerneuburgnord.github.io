// Funktionen für KMZ-Export
function createAndExportKMZ() {
    // Wenn es sich um ein bearbeitetes Polygon handelt, speichern wir die Änderungen
    if (typeof isEditingExistingPolygon !== 'undefined' && isEditingExistingPolygon) {
        if (typeof saveEditedPolygon === 'function' && saveEditedPolygon(true)) {
            alert('Die Änderungen am Polygon wurden gespeichert und werden exportiert.');
            
            // Zurück zum Normalmodus
            if (typeof clearPolygonPoints === 'function') {
                clearPolygonPoints();
            }
            
            // Zeige alle aktivierten Layer wieder an
            for (const layerName in layers) {
                const checkbox = document.getElementById(layerName);
                if (checkbox && checkbox.checked) {
                    layers[layerName].addTo(map);
                }
            }
            
            // Aktualisiere die Polygon-Auswahlliste
            if (typeof updatePolygonSelectOptions === 'function') {
                updatePolygonSelectOptions();
            }
            
            return;
        }
    }
    
    // KMZ-Export-Dialog öffnen
    showEmailModal();
}

function createKMZWithMetadata(name, description) {
    // Ein neues JSZip-Objekt erstellen
    const zip = new JSZip();
    
    // Erstelle ein geschlossenes Polygon
    let coordinates = [...polygonPoints];
    if (coordinates.length > 0 && 
        (coordinates[0][0] !== coordinates[coordinates.length-1][0] || 
         coordinates[0][1] !== coordinates[coordinates.length-1][1])) {
        coordinates.push([...coordinates[0]]);
    }
    
    // Berechne die ungefähre Fläche
    let area = 0;
    if (typeof calculatePolygonArea === 'function') {
        area = calculatePolygonArea(coordinates);
    } else {
        console.warn('Flächenberechnung nicht verfügbar');
    }
    
    const areaText = `${(area / 10000).toFixed(2)} Hektar (${area.toFixed(0)} m²)`;
    
    // Beschreibung formatieren, W3W-Link behalten
    let finalDescription = description || '';
    if (!finalDescription.includes('Fläche:')) {
        finalDescription += finalDescription ? '\n\n' : '';
        finalDescription += `Fläche: ${areaText}`;
    }
    
    // Erstelle KML-Inhalt
    const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Wiesen Neuburg Nord - ${name}</name>
    <Style id="polygonStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>3</width>
      </LineStyle>
      <PolyStyle>
        <color>4d0000ff</color>
      </PolyStyle>
    </Style>
    <Placemark>
      <name>${name}</name>
      <description>${finalDescription}</description>
      <styleUrl>#polygonStyle</styleUrl>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>
              ${coordinates.map(point => `${point[1]},${point[0]},0`).join('\n              ')}
            </coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>
  </Document>
</kml>`;
    
    // Füge die KML-Datei zum ZIP hinzu
    zip.file("doc.kml", kmlContent);
    
    // Erzeuge einen Blob (wird asynchron zurückgegeben)
    return zip.generateAsync({type: "blob"});
}

function createAndDownloadKMZ(name, description) {
    if (!name) {
        console.warn('Kein Name für KMZ-Export angegeben');
        name = 'Neue_Fläche';
    }
    
    // KMZ mit Metadaten erstellen
    createKMZWithMetadata(name, description).then(function(kmzBlob) {
        // Lokalen Download anbieten
        const fileName = name.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
        const url = URL.createObjectURL(kmzBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${fileName}.kmz`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }).catch(function(error) {
        console.error('Fehler beim Erstellen der KMZ-Datei:', error);
        alert('Beim Erstellen der KMZ-Datei ist ein Fehler aufgetreten.');
    });
}

function showEmailModal() {
    // Modal-Element prüfen
    const modal = document.getElementById('email-modal');
    if (!modal) {
        console.error('Email-Modal nicht gefunden');
        return;
    }
    
    // Modal anzeigen
    modal.style.display = "block";
    
    // Titel anpassen, je nachdem ob wir im Bearbeitungsmodus sind
    const modalTitle = modal.querySelector('h3');
    if (modalTitle) {
        if (typeof isEditingExistingPolygon !== 'undefined' && isEditingExistingPolygon) {
            modalTitle.textContent = 'Bearbeitetes Polygon exportieren';
        } else {
            modalTitle.textContent = 'KMZ per E-Mail versenden';
        }
    }
    
    // What3Words-Adresse für die Mitte des Polygons ermitteln
    const w3wButton = document.getElementById('get-w3w');
    if (w3wButton) {
        w3wButton.onclick = getWhat3WordsAddress;
    }
    
    // Download-Button-Funktionalität
    const downloadBtn = document.getElementById('download-kmz');
    if (downloadBtn) {
        downloadBtn.onclick = function() {
            // Hole Polygon-Namen und Beschreibung
            const nameField = document.getElementById('polygon-name');
            const descField = document.getElementById('polygon-description');
            
            const name = nameField ? nameField.value : 'Neue Fläche';
            const description = descField ? descField.value : '';
            
            // Erstelle aktualisierten KMZ-Blob mit neuem Namen und Beschreibung
            createAndDownloadKMZ(name, description);
            
            // Modal schließen
            modal.style.display = "none";
        };
    }
    
    // Close-Button-Funktionalität
    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = "none";
        };
    }
    
    // Abbrechen-Button
    const cancelBtn = document.getElementById('cancel-email');
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            modal.style.display = "none";
        };
    }
    
    // Senden-Button
    const sendBtn = document.getElementById('send-email');
    if (sendBtn) {
        sendBtn.onclick = function() {
            const toField = document.getElementById('email-to');
            const subjectField = document.getElementById('email-subject');
            const bodyField = document.getElementById('email-body');
            const nameField = document.getElementById('polygon-name');
            const descField = document.getElementById('polygon-description');
            
            const to = toField ? toField.value : '';
            const subject = subjectField ? subjectField.value : 'Polygon Export';
            const body = bodyField ? bodyField.value : '';
            const name = nameField ? nameField.value : 'Neue Fläche';
            const description = descField ? descField.value : '';
            
            if (!to) {
                alert('Bitte geben Sie eine E-Mail-Adresse ein.');
                return;
            }
            
            // Erzeuge aktualisierten KMZ-Blob mit Namen und Beschreibung
            const updatedKmzBlob = createKMZWithMetadata(name, description);
            
            // Sende E-Mail (in echter Implementierung würde hier ein AJAX-Call stehen)
            sendEmailWithAttachment(to, subject, body, updatedKmzBlob);
            modal.style.display = "none";
        };
    }
    
    // Wenn außerhalb des Modals geklickt wird, schließen
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
    
    // Automatisch What3Words ermitteln
    setTimeout(() => {
        if (w3wButton) {
            w3wButton.click();
        }
    }, 500);
}

// What3Words-Adresse für die Mitte des Polygons ermitteln
function getWhat3WordsAddress() {
    if (!polygonLayer) {
        console.warn('Kein polygonLayer für What3Words-Adresse vorhanden');
        return;
    }
    
    // Mittelpunkt des Polygons berechnen
    const bounds = polygonLayer.getBounds();
    const center = bounds.getCenter();
    
    // Lade Status anzeigen
    const w3wInput = document.getElementById('w3w-address');
    if (!w3wInput) {
        console.error('What3Words-Adressfeld nicht gefunden');
        return;
    }
    
    w3wInput.value = 'Wird ermittelt...';
    
    // What3Words API-Aufruf
    fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${center.lat},${center.lng}&language=de&format=json&key=YOUR_API_KEY`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP-Fehler: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.words) {
                // W3W-Adresse anzeigen
                w3wInput.value = data.words;
                
                // URL im Format what3words.com/wort1.wort2.wort3 erstellen
                const w3wUrl = `https://what3words.com/${data.words}`;
                
                // Zur Beschreibung hinzufügen
                const descriptionField = document.getElementById('polygon-description');
                if (descriptionField) {
                    // Alte What3Words-Einträge entfernen
                    let description = descriptionField.value;
                    const lines = description.split('\n');
                    const filteredLines = lines.filter(line => !line.toLowerCase().includes('what3words'));
                    description = filteredLines.join('\n');
                    
                    // Neuen What3Words-Link hinzufügen
                    if (description) {
                        description += '\n\n';
                    }
                    description += `What3Words: ${w3wUrl}`;
                    descriptionField.value = description;
                }
            } else {
                w3wInput.value = 'Fehler bei der Ermittlung';
                console.warn('What3Words-API hat keine Wörter zurückgegeben:', data);
            }
        })
        .catch(error => {
            console.error('Fehler bei der W3W-Abfrage:', error);
            w3wInput.value = 'API-Fehler';
            
            // Fallback für Demos ohne API-Key
            const mockW3W = 'beispiel.demo.adresse';
            w3wInput.value = mockW3W;
            
            // Zur Beschreibung hinzufügen
            const descriptionField = document.getElementById('polygon-description');
            if (descriptionField) {
                // Alte What3Words-Einträge entfernen
                let description = descriptionField.value;
                const lines = description.split('\n');
                const filteredLines = lines.filter(line => !line.toLowerCase().includes('what3words'));
                description = filteredLines.join('\n');
                
                // Neuen What3Words-Link hinzufügen
                if (description) {
                    description += '\n\n';
                }
                description += `What3Words: https://what3words.com/${mockW3W}`;
                descriptionField.value = description;
            }
        });
}

function sendEmailWithAttachment(to, subject, body, kmzBlobPromise) {
    // KMZ-Blob auflösen (falls es ein Promise ist)
    if (kmzBlobPromise instanceof Promise) {
        kmzBlobPromise.then(blob => sendEmailWithAttachment(to, subject, body, blob))
        .catch(error => {
            console.error('Fehler beim Auflösen des KMZ-Blobs:', error);
            alert('Beim Vorbereiten der E-Mail ist ein Fehler aufgetreten.');
        });
        return;
    }
    
    // In einer echten Implementierung würde hier ein AJAX-Call zum Server stehen
    // Hier Download-Option als Fallback
    alert('E-Mail-Versand-Funktion ist noch nicht implementiert. Die KMZ-Datei wird stattdessen zum Download angeboten.');
    
    // Lokalen Download anbieten
    const nameField = document.getElementById('polygon-name');
    const name = nameField ? nameField.value : 'Wiesen_Neuburg_Nord_Polygon';
    const safeName = name.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
    
    const url = URL.createObjectURL(kmzBlobPromise);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.kmz`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}