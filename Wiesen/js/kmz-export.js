/**
 * KMZ Export Funktionalitäten
 * Enthält Funktionen zum Erstellen, Herunterladen und per E-Mail versenden von KMZ-Dateien
 */

// Hauptfunktion zum Starten des Export-Prozesses
function createAndExportKMZ() {
    try {
        // Prüfen ob ein bearbeitetes Polygon vorliegt
        if (typeof isEditingExistingPolygon !== 'undefined' && isEditingExistingPolygon) {
            if (typeof saveEditedPolygon === 'function') {
                const saved = saveEditedPolygon(true);
                if (saved) {
                    alert('Die Änderungen am Polygon wurden gespeichert und werden exportiert.');
                    
                    // Polygon-Bearbeitung zurücksetzen
                    if (typeof clearPolygonPoints === 'function') {
                        clearPolygonPoints();
                    }
                    
                    // Alle aktivierten Layer wieder anzeigen
                    for (const layerName in layers) {
                        const checkbox = document.getElementById(layerName);
                        if (checkbox && checkbox.checked) {
                            layers[layerName].addTo(map);
                        }
                    }
                    
                    // Polygon-Auswahlliste aktualisieren
                    if (typeof updatePolygonSelectOptions === 'function') {
                        updatePolygonSelectOptions();
                    }

                    showEmailModal();
                    
                    return;
                }
            }
        }
        
        // KMZ-Export-Dialog anzeigen
        showEmailModal();
    } catch (error) {
        console.error("Fehler beim KMZ-Export:", error);
        alert("Beim Exportieren des Polygons ist ein Fehler aufgetreten.");
    }
}

/**
 * Erstellt eine KMZ-Datei mit den angegebenen Metadaten
 * @param {string} name - Name des Polygons
 * @param {string} description - Beschreibung des Polygons
 * @returns {Promise<Blob>} - Promise mit dem Blob der KMZ-Datei
 */
function createKMZWithMetadata(name, description) {
    return new Promise((resolve, reject) => {
        try {
            // Prüfen, ob JSZip vorhanden ist
            if (typeof JSZip !== 'function') {
                throw new Error("JSZip-Bibliothek nicht gefunden");
            }
            
            // Prüfen, ob polygonPoints vorhanden und nicht leer ist
            if (!polygonPoints || polygonPoints.length < 3) {
                throw new Error("Zu wenige Punkte für ein gültiges Polygon");
            }
            
            // Erstelle ein JSZip-Objekt
            const zip = new JSZip();
            
            // Sichere Standardwerte falls Parameter fehlen
            const polygonName = name || 'Neues Polygon';
            const polygonDesc = description || '';
            
            // Polygon-Punkte kopieren und sicherstellen, dass es geschlossen ist
            let coordinates = [...polygonPoints];
            const firstPoint = coordinates[0];
            const lastPoint = coordinates[coordinates.length - 1];
            
            // Polygon schließen, wenn Start- und Endpunkt nicht identisch
            if (firstPoint[0] !== lastPoint[0] || firstPoint[1] !== lastPoint[1]) {
                coordinates.push([...firstPoint]);
            }
            
            // Fläche berechnen
            let areaValue = 0;
            if (typeof calculatePolygonArea === 'function') {
                try {
                    areaValue = calculatePolygonArea(coordinates);
                } catch (e) {
                    console.warn("Fehler bei der Flächenberechnung:", e);
                }
            }
            
            // Flächentext formatieren
            const areaText = `${(areaValue / 10000).toFixed(2)} Hektar (${areaValue.toFixed(0)} m²)`;
            
            // Beschreibung ergänzen, wenn noch keine Flächenangabe vorhanden
            let finalDescription = polygonDesc;
            if (!finalDescription.includes('Fläche:')) {
                finalDescription += finalDescription ? '\n\n' : '';
                finalDescription += `Fläche: ${areaText}`;
            }
            
            // XML-Sonderzeichen in Name und Beschreibung ersetzen
            const safeName = polygonName.replace(/[&<>"']/g, c => {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&apos;'
                }[c];
            });
            
            const safeDescription = finalDescription.replace(/[&<>"']/g, c => {
                return {
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&apos;'
                }[c];
            });
            
            // Debug-Ausgabe
            console.log("Erstelle KML mit:", {
                name: safeName,
                coordCount: coordinates.length
            });
            
            // KML-Inhalt erstellen
            const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Wiesen Neuburg Nord - ${safeName}</name>
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
      <name>${safeName}</name>
      <description>${safeDescription}</description>
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
            
            // KML-Datei zum ZIP hinzufügen
            zip.file("doc.kml", kmlContent);
            
            // Debug-Ausgabe für KML
            console.log("KML-Datei erstellt, Länge:", kmlContent.length);
            
            // KMZ als Blob generieren
            zip.generateAsync({type: "blob"})
                .then(blob => {
                    console.log("ZIP-Blob erstellt, Größe:", blob.size);
                    resolve(blob);
                })
                .catch(error => {
                    console.error("Fehler beim Generieren des ZIP-Archivs:", error);
                    reject(error);
                });
                
        } catch (error) {
            console.error("Fehler beim Erstellen der KMZ-Datei:", error);
            reject(error);
        }
    });
}
/**
 * Erstellt und downloadet eine KMZ-Datei
 * @param {string} name - Name des Polygons
 * @param {string} description - Beschreibung des Polygons
 */
function createAndDownloadKMZ(name, description) {
    try {
        // Prüfen, ob polygonPoints vorhanden und nicht leer ist
        if (!polygonPoints || polygonPoints.length < 3) {
            throw new Error("Zu wenige Punkte für ein gültiges Polygon");
        }
        
        // Prüfen, ob JSZip vorhanden ist
        if (typeof JSZip !== 'function') {
            console.error("JSZip-Bibliothek nicht gefunden");
            alert("Fehlende JavaScript-Bibliothek: JSZip");
            return;
        }
        
        const filename = name ? name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_') : 'Neues_Polygon';
        
        // Debug-Ausgabe
        console.log("Starte KMZ-Erstellung mit:", {
            name: name,
            description: description,
            pointsCount: polygonPoints.length
        });
        
        createKMZWithMetadata(name, description)
            .then(blob => {
                if (!blob) {
                    throw new Error("Kein Blob von createKMZWithMetadata erhalten");
                }
                
                console.log("KMZ-Blob erstellt, Größe:", blob.size);
                
                // Download-Link erstellen
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `${filename}.kmz`;
                
                // Link zum DOM hinzufügen, klicken und entfernen
                document.body.appendChild(link);
                link.click();
                
                // Aufräumen
                setTimeout(() => {
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                }, 100);
            })
            .catch(error => {
                console.error("Download fehlgeschlagen:", error);
                alert("Beim Herunterladen der KMZ-Datei ist ein Fehler aufgetreten: " + error.message);
            });
    } catch (error) {
        console.error("Fehler beim Vorbereiten des Downloads:", error);
        alert("Beim Erstellen der KMZ-Datei ist ein Fehler aufgetreten: " + error.message);
    }
}
/**
 * Zeigt den E-Mail-Dialog zum Versenden des KMZ-Exports an
 */
function showEmailModal() {
    try {
        // Modal-Element suchen
        const modal = document.getElementById('email-modal');
        if (!modal) {
            console.error("E-Mail-Modal nicht gefunden");
            alert("Der Export-Dialog konnte nicht geöffnet werden.");
            return;
        }
        
        // Modal anzeigen
        modal.style.display = "block";
        
        // Titel entsprechend dem Bearbeitungsstatus anpassen
        const headerElement = modal.querySelector('h3');
        if (headerElement) {
            if (typeof isEditingExistingPolygon !== 'undefined' && isEditingExistingPolygon) {
                headerElement.textContent = 'Bearbeitete Fläche exportieren';
            } else {
                headerElement.textContent = 'Fläche per E-Mail versenden';
            }
        }
        
        // What3Words-Button vorbereiten
        setupWhat3WordsButton();
        
        // Download-Button
        setupDownloadButton(modal);
        
        // Schließen- und Abbrechen-Buttons
        setupCloseButtons(modal);
        
        // Senden-Button
        setupSendButton(modal);
        
        // Klick außerhalb schließt Modal
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = "none";
            }
        };
        
        // What3Words automatisch ermitteln
        setTimeout(() => {
            const w3wButton = document.getElementById('get-w3w');
            if (w3wButton) {
                w3wButton.click();
            }
        }, 300);
    } catch (error) {
        console.error("Fehler beim Anzeigen des E-Mail-Dialogs:", error);
        alert("Der Export-Dialog konnte nicht geöffnet werden.");
    }
}

/**
 * Richtet den What3Words-Button ein
 */
function setupWhat3WordsButton() {
    const w3wButton = document.getElementById('get-w3w');
    if (w3wButton) {
        w3wButton.onclick = getWhat3WordsAddress;
    }
}

/**
 * Richtet den Download-Button ein
 */
function setupDownloadButton(modal) {
    const downloadBtn = document.getElementById('download-kmz');
    if (downloadBtn) {
        downloadBtn.onclick = function() {
            try {
                const nameField = document.getElementById('polygon-name');
                const descField = document.getElementById('polygon-description');
                
                const name = nameField ? nameField.value : 'Neues Polygon';
                const description = descField ? descField.value : '';
                
                createAndDownloadKMZ(name, description);
                modal.style.display = "none";
            } catch (error) {
                console.error("Fehler beim Download:", error);
                alert("Beim Herunterladen der KMZ-Datei ist ein Fehler aufgetreten.");
            }
        };
    }
}

/**
 * Richtet die Schließen-Buttons ein
 */
function setupCloseButtons(modal) {
    // Schließen-Button oben rechts
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
}

/**
 * Richtet den Senden-Button ein
 */
function setupSendButton(modal) {
    const sendBtn = document.getElementById('send-email');
    if (sendBtn) {
        sendBtn.onclick = function() {
            try {
                // Eingabefelder auslesen
                const toField = document.getElementById('email-to');
                const subjectField = document.getElementById('email-subject');
                const bodyField = document.getElementById('email-body');
                const nameField = document.getElementById('polygon-name');
                const descField = document.getElementById('polygon-description');
                
                // Werte abrufen
                const to = toField ? toField.value : '';
                const subject = subjectField ? subjectField.value : 'Polygon Export - Wiesen Neuburg Nord';
                const body = bodyField ? bodyField.value : '';
                const name = nameField ? nameField.value : 'Neues Polygon';
                const description = descField ? descField.value : '';
                
                // E-Mail-Adresse prüfen
                if (!to || !to.includes('@')) {
                    alert('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
                    if (toField) toField.focus();
                    return;
                }
                
                // KMZ erstellen und versenden
                createKMZWithMetadata(name, description)
                    .then(blob => {
                        sendEmailWithAttachment(to, subject, body, blob);
                        modal.style.display = "none";
                    })
                    .catch(error => {
                        console.error("Fehler beim Erstellen der KMZ:", error);
                        alert("Beim Vorbereiten des E-Mail-Anhangs ist ein Fehler aufgetreten.");
                    });
            } catch (error) {
                console.error("Fehler beim E-Mail-Versand:", error);
                alert("Beim Vorbereiten der E-Mail ist ein Fehler aufgetreten.");
            }
        };
    }
}

/**
 * Ermittelt die What3Words-Adresse für die Mitte des Polygons
 */
function getWhat3WordsAddress() {
    try {
        if (!polygonLayer) {
            console.warn("Kein Polygon vorhanden für What3Words-Ermittlung");
            return;
        }
        
        // Mittelpunkt des Polygons berechnen
        const bounds = polygonLayer.getBounds();
        const center = bounds.getCenter();
        
        // Lade-Status anzeigen
        const w3wInput = document.getElementById('w3w-address');
        if (w3wInput) {
            w3wInput.value = 'Wird ermittelt...';
        }
        
        
        // Da wir keinen API-Key haben, verwenden wir einen Dummy-Wert
        setTimeout(() => {
            const mockW3W = 'beispiel.demo.adresse';
            
            // What3Words-Feld aktualisieren
            if (w3wInput) {
                w3wInput.value = mockW3W;
            }
            
            // Beschreibungsfeld aktualisieren
            updateDescriptionWithW3W(mockW3W);
        }, 500);
        /*

        // API-Key für What3Words
        const apiKey = 'IPAZBM3Y';
        
        // Für echte Implementierung mit API-Key:
        // Anfrage an die What3Words API
        fetch(`https://api.what3words.com/v3/convert-to-3wa?coordinates=${center.lat},${center.lng}&language=de&format=json&key=${apiKey}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP-Fehler: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data && data.words) {
                    if (w3wInput) {
                        w3wInput.value = data.words;
                    }
                    updateDescriptionWithW3W(data.words);
                } else {
                    throw new Error("Ungültige Antwort von What3Words API");
                }
            })
            .catch(error => {
                console.error("Fehler bei der What3Words-API:", error);
                // Fallback für Fehlerfall
                const mockW3W = 'beispiel.demo.adresse';
                if (w3wInput) {
                    w3wInput.value = mockW3W;
                }
                updateDescriptionWithW3W(mockW3W);
            });
        */
    } catch (error) {
        console.error("Fehler bei der What3Words-Verarbeitung:", error);
        const w3wInput = document.getElementById('w3w-address');
        if (w3wInput) {
            w3wInput.value = 'Fehler bei der Ermittlung';
        }
    }
}

/**
 * Aktualisiert das Beschreibungsfeld mit der What3Words-Adresse
 */
function updateDescriptionWithW3W(words) {
    try {
        const descField = document.getElementById('polygon-description');
        if (!descField) return;
        
        // URL erstellen
        const w3wUrl = `https://what3words.com/${words}`;
        
        // Bestehenden Text abrufen und What3Words-Einträge entfernen
        let description = descField.value || '';
        const lines = description.split('\n');
        const filteredLines = lines.filter(line => !line.toLowerCase().includes('what3words'));
        description = filteredLines.join('\n').trim();
        
        // Neuen What3Words-Link hinzufügen
        if (description) {
            description += '\n\n';
        }
        description += `What3Words: ${w3wUrl}`;
        
        // Aktualisiertes Feld setzen
        descField.value = description;
    } catch (error) {
        console.error("Fehler beim Aktualisieren der Beschreibung:", error);
    }
}

/**
 * Sendet eine E-Mail mit KMZ-Anhang
 */
function sendEmailWithAttachment(to, subject, body, kmzBlob) {
    try {
        // Hier würde in einer echten Implementierung ein API-Aufruf stehen
        // Da wir keinen Server haben, bieten wir den Download als Fallback an
        
        alert('E-Mail-Versand nicht implementiert. Die KMZ-Datei wird stattdessen zum Download angeboten.');
        
        // Dateinamen aus dem Polygon-Namen erstellen
        const nameField = document.getElementById('polygon-name');
        const name = nameField ? nameField.value : 'Wiesen_Neuburg_Nord_Polygon';
        const filename = name.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_');
        
        // Download anbieten
        const url = URL.createObjectURL(kmzBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.kmz`;
        document.body.appendChild(link);
        link.click();
        
        // Aufräumen
        setTimeout(() => {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    } catch (error) {
        console.error("Fehler beim E-Mail-Versand:", error);
        alert("Beim Versenden der E-Mail ist ein Fehler aufgetreten.");
    }
}