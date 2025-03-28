// Funktionen für KMZ-Export
function createAndExportKMZ() {
    // Wenn es sich um ein bearbeitetes Polygon handelt, speichern wir die Änderungen
    if (isEditingExistingPolygon) {
        if (saveEditedPolygon()) {
            alert('Die Änderungen am Polygon wurden gespeichert.');
            
            // Zurück zum Normalmodus
            clearPolygonPoints();
            
            // Zeige alle aktivierten Layer wieder an
            for (const layerName in layers) {
                const checkbox = document.getElementById(layerName);
                if (checkbox && checkbox.checked) {
                    layers[layerName].addTo(map);
                }
            }
            
            // Aktualisiere die Polygon-Auswahlliste
            updatePolygonSelectOptions();
            
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
    if (coordinates[0][0] !== coordinates[coordinates.length-1][0] || 
        coordinates[0][1] !== coordinates[coordinates.length-1][1]) {
        coordinates.push([...coordinates[0]]);
    }
    
    // Berechne die ungefähre Fläche
    const area = calculatePolygonArea(coordinates);
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
    });
}

function showEmailModal(kmzBlob) {
    // Modal anzeigen
    const modal = document.getElementById('email-modal');
    modal.style.display = "block";
    
    // Titel anpassen, je nachdem ob wir im Bearbeitungsmodus sind
    const modalTitle = modal.querySelector('h3');
    if (isEditingExistingPolygon) {
        modalTitle.textContent = 'Bearbeitetes Polygon exportieren';
    } else {
        modalTitle.textContent = 'KMZ per E-Mail versenden';
    }
    
    // What3Words-Adresse für die Mitte des Polygons ermitteln
    document.getElementById('get-w3w').onclick = function() {
        if (!polygonLayer) return;
        
        // Mittelpunkt des Polygons berechnen
        const bounds = polygonLayer.getBounds();
        const center = bounds.getCenter();
        
        // Lade Status anzeigen
        const w3wInput = document.getElementById('w3w-address');
        w3wInput.value = 'Wird ermittelt...';
        
        // What3Words API-Aufruf
        fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${center.lat},${center.lng}&language=de&format=json&key=YOUR_API_KEY`)
            .then(response => response.json())
            .then(data => {
                if (data.words) {
                    // W3W-Adresse anzeigen
                    w3wInput.value = data.words;
                    
                    // URL im Format what3words.com/wort1.wort2.wort3 erstellen
                    const w3wUrl = `https://what3words.com/${data.words}`;
                    
                    // Zur Beschreibung hinzufügen
                    const descriptionField = document.getElementById('polygon-description');
                    let description = descriptionField.value;
                    
                    // Prüfen, ob bereits eine W3W-Adresse enthalten ist
                    if (!description.includes('what3words.com')) {
                        // Zeile für W3W hinzufügen
                        description += description ? '\n\n' : '';
                        description += `What3Words: ${w3wUrl}`;
                        descriptionField.value = description;
                    }
                } else {
                    w3wInput.value = 'Fehler bei der Ermittlung';
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
                let description = descriptionField.value;
                
                if (!description.includes('what3words.com')) {
                    description += description ? '\n\n' : '';
                    description += `What3Words: https://what3words.com/${mockW3W}`;
                    descriptionField.value = description;
                }
            });
    };
    
    // Download-Button-Funktionalität
    const downloadBtn = document.getElementById('download-kmz');
    downloadBtn.onclick = function() {
        // Hole Polygon-Namen und Beschreibung
        const name = document.getElementById('polygon-name').value || 'Neue Fläche';
        const description = document.getElementById('polygon-description').value || '';
        
        // Erstelle aktualisierten KMZ-Blob mit neuem Namen und Beschreibung
        createAndDownloadKMZ(name, description);
        
        // Modal schließen
        modal.style.display = "none";
    };
    
    // Close-Button-Funktionalität
    const closeBtn = document.querySelector('.close');
    closeBtn.onclick = function() {
        modal.style.display = "none";
    };
    
    // Abbrechen-Button
    const cancelBtn = document.getElementById('cancel-email');
    cancelBtn.onclick = function() {
        modal.style.display = "none";
    };
    
    // Senden-Button
    const sendBtn = document.getElementById('send-email');
    sendBtn.onclick = function() {
        const to = document.getElementById('email-to').value;
        const subject = document.getElementById('email-subject').value;
        const body = document.getElementById('email-body').value;
        const name = document.getElementById('polygon-name').value || 'Neue Fläche';
        const description = document.getElementById('polygon-description').value || '';
        
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
    
    // Wenn außerhalb des Modals geklickt wird, schließen
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
    
    // Automatisch What3Words ermitteln
    setTimeout(() => {
        document.getElementById('get-w3w').click();
    }, 500);
}

function sendEmailWithAttachment(to, subject, body, kmzBlobPromise) {
    // KMZ-Blob auflösen (falls es ein Promise ist)
    if (kmzBlobPromise instanceof Promise) {
        kmzBlobPromise.then(blob => sendEmailWithAttachment(to, subject, body, blob));
        return;
    }
    
    // In einer echten Implementierung würde hier ein AJAX-Call zum Server stehen
    // Hier Download-Option als Fallback
    alert('E-Mail-Versand-Funktion ist noch nicht implementiert. Die KMZ-Datei wird stattdessen zum Download angeboten.');
    
    // Lokalen Download anbieten
    const name = document.getElementById('polygon-name').value || 'Wiesen_Neuburg_Nord_Polygon';
    const safeName = name.replace(/[^\w\s-]/gi, '').replace(/\s+/g, '_');
    
    const url = URL.createObjectURL(kmzBlobPromise);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeName}.kmz`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}