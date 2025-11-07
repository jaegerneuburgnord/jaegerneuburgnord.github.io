/**
 * kml-manager.js
 * Verwaltet KML-Dateien mit Offline-Unterstützung
 */

class KmlManager {
    constructor() {
        this.dbManager = window.dbManager;
        this.apiClient = window.apiClient;
    }

    /**
     * Lädt eine KML-Datei hoch (Server + lokale Speicherung)
     * @param {File} file - KML-Datei
     * @param {string} name - Optionaler Name
     * @returns {Promise<Object>} - Upload-Ergebnis
     */
    async uploadKml(file, name = null) {
        try {
            // Versuche Upload zum Server
            let kmlContent = null;
            let uploadedToServer = false;

            if (navigator.onLine) {
                try {
                    const response = await this.apiClient.uploadKml(file, name);
                    kmlContent = response.kml_content;
                    uploadedToServer = true;
                } catch (error) {
                    console.error('Server-Upload fehlgeschlagen:', error);
                }
            }

            // Falls Server-Upload fehlgeschlagen, Datei lokal lesen
            if (!kmlContent) {
                kmlContent = await this.readFileAsText(file);
            }

            // Lokal in IndexedDB speichern
            const kmlData = {
                filename: name || file.name,
                content: kmlContent,
                size: file.size,
                uploaded: new Date().toISOString(),
                syncedToServer: uploadedToServer
            };

            await this.saveKmlLocal(kmlData);

            return {
                success: true,
                filename: kmlData.filename,
                syncedToServer: uploadedToServer,
                message: uploadedToServer
                    ? 'KML hochgeladen und lokal gespeichert'
                    : 'KML lokal gespeichert (Server nicht erreichbar)'
            };

        } catch (error) {
            console.error('Fehler beim KML-Upload:', error);
            throw error;
        }
    }

    /**
     * Liest eine Datei als Text
     * @param {File} file - Datei
     * @returns {Promise<string>} - Dateiinhalt
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Speichert KML lokal in IndexedDB
     * @param {Object} kmlData - KML-Daten
     * @returns {Promise<number>} - ID
     */
    async saveKmlLocal(kmlData) {
        // Verwende dbManager für IndexedDB-Zugriff
        const db = await this.dbManager.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['kmlFiles'], 'readwrite');
            const store = transaction.objectStore('kmlFiles');

            const request = store.put(kmlData);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Holt alle lokal gespeicherten KML-Dateien
     * @returns {Promise<Array>} - KML-Dateien
     */
    async getAllKmlLocal() {
        const db = await this.dbManager.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['kmlFiles'], 'readonly');
            const store = transaction.objectStore('kmlFiles');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Holt eine KML-Datei nach Name
     * @param {string} filename - Dateiname
     * @returns {Promise<Object>} - KML-Daten
     */
    async getKmlByFilename(filename) {
        const allKml = await this.getAllKmlLocal();
        return allKml.find(kml => kml.filename === filename);
    }

    /**
     * Löscht eine KML-Datei (lokal und Server)
     * @param {string} filename - Dateiname
     * @returns {Promise<boolean>} - true bei Erfolg
     */
    async deleteKml(filename) {
        try {
            // Versuche vom Server zu löschen
            if (navigator.onLine) {
                try {
                    await this.apiClient.deleteKml(filename);
                } catch (error) {
                    console.error('Server-Löschung fehlgeschlagen:', error);
                }
            }

            // Lokal löschen
            const db = await this.dbManager.openDatabase();

            return new Promise((resolve, reject) => {
                const transaction = db.transaction(['kmlFiles'], 'readwrite');
                const store = transaction.objectStore('kmlFiles');

                // Suche nach Filename
                const index = store.index('filename');
                const request = index.openCursor(IDBKeyRange.only(filename));

                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        cursor.delete();
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                };

                request.onerror = () => reject(request.error);
            });

        } catch (error) {
            console.error('Fehler beim Löschen der KML-Datei:', error);
            return false;
        }
    }

    /**
     * Synchronisiert KMZ-Dateien aus /home/wildkamera/Reviere mit dem Client
     * Server ist Ground Truth - verwendet Hash-basierte Synchronisation
     * @returns {Promise<Object>} - Sync-Ergebnis
     */
    async syncReviere() {
        if (!navigator.onLine) {
            return { success: false, message: 'Offline - Synchronisation nicht möglich' };
        }

        try {
            console.log('[KML-Manager] Starte Reviere-Synchronisation...');

            // Hole alle lokalen KMZ-Dateien mit Hashes
            const localKmls = await this.getAllKmlLocal();
            const localHashes = localKmls
                .filter(kml => kml.hash)
                .map(kml => kml.hash);

            console.log(`[KML-Manager] Lokale Dateien: ${localKmls.length}, Hashes: ${localHashes.length}`);

            // Hole Server-Liste
            const serverUrl = this.apiClient.getServerUrl();
            const response = await fetch(`${serverUrl}/reviere/kmz/list`);

            if (!response.ok) {
                throw new Error(`Server-Fehler: ${response.status}`);
            }

            const serverData = await response.json();
            const serverFiles = serverData.files || [];

            console.log(`[KML-Manager] Server-Dateien: ${serverFiles.length}`);

            let downloaded = 0;
            let skipped = 0;
            let deleted = 0;
            let errors = 0;

            // Download neue/geänderte Dateien vom Server
            for (const serverFile of serverFiles) {
                // Prüfe ob wir die Datei bereits haben (Hash-Vergleich)
                const localFile = localKmls.find(lk => lk.hash === serverFile.hash);

                if (localFile) {
                    skipped++;
                    console.log(`[KML-Manager] Übersprungen (bereits vorhanden): ${serverFile.filename}`);
                    continue;
                }

                try {
                    console.log(`[KML-Manager] Lade herunter: ${serverFile.filename} (${serverFile.revier})`);

                    // Extrahiere KML aus KMZ
                    const extractResponse = await fetch(
                        `${serverUrl}/reviere/kmz/extract?file_hash=${serverFile.hash}`
                    );

                    if (!extractResponse.ok) {
                        throw new Error(`Extraktion fehlgeschlagen: ${extractResponse.status}`);
                    }

                    const extractData = await extractResponse.json();

                    // Speichere lokal mit Hash
                    await this.saveKmlLocal({
                        filename: serverFile.filename,
                        revier: serverFile.revier,
                        content: extractData.kml_content,
                        size: serverFile.size,
                        uploaded: serverFile.modified,
                        hash: serverFile.hash,
                        syncedFromReviere: true,
                        lastSync: new Date().toISOString()
                    });

                    downloaded++;
                    console.log(`[KML-Manager] Heruntergeladen: ${serverFile.filename}`);

                } catch (error) {
                    console.error(`[KML-Manager] Fehler beim Download von ${serverFile.filename}:`, error);
                    errors++;
                }
            }

            // Lösche lokale Dateien, die auf dem Server nicht mehr existieren
            const serverHashes = serverFiles.map(sf => sf.hash);

            for (const localKml of localKmls) {
                if (localKml.syncedFromReviere && localKml.hash && !serverHashes.includes(localKml.hash)) {
                    try {
                        console.log(`[KML-Manager] Lösche (nicht mehr auf Server): ${localKml.filename}`);
                        await this.deleteKml(localKml.filename);
                        deleted++;
                    } catch (error) {
                        console.error(`[KML-Manager] Fehler beim Löschen von ${localKml.filename}:`, error);
                    }
                }
            }

            const message = `Reviere-Sync: ${downloaded} neu, ${skipped} aktuell, ${deleted} gelöscht`;
            console.log(`[KML-Manager] ${message}`);

            if (errors > 0) {
                console.warn(`[KML-Manager] ${errors} Fehler aufgetreten`);
            }

            return {
                success: true,
                downloaded,
                skipped,
                deleted,
                errors,
                total_server_files: serverFiles.length,
                message
            };

        } catch (error) {
            console.error('[KML-Manager] Fehler beim Synchronisieren:', error);
            return {
                success: false,
                message: `Sync fehlgeschlagen: ${error.message}`
            };
        }
    }

    /**
     * Synchronisiert KML-Dateien mit dem Server (alte Methode für manuelles Upload)
     * @returns {Promise<Object>} - Sync-Ergebnis
     */
    async syncWithServer() {
        if (!navigator.onLine) {
            return { success: false, message: 'Offline' };
        }

        try {
            // Hole alle lokalen KML-Dateien
            const localKmls = await this.getAllKmlLocal();

            // Hole Server-Liste
            const serverResponse = await this.apiClient.listKmlFiles();
            const serverKmls = serverResponse.files || [];

            let uploaded = 0;
            let downloaded = 0;

            // Upload lokale Dateien, die nicht auf dem Server sind
            for (const localKml of localKmls) {
                if (!localKml.syncedToServer) {
                    const serverHasFile = serverKmls.some(sk => sk.filename === localKml.filename);

                    if (!serverHasFile) {
                        try {
                            // Erstelle Blob aus Inhalt
                            const blob = new Blob([localKml.content], { type: 'application/vnd.google-earth.kml+xml' });
                            const file = new File([blob], localKml.filename, { type: blob.type });

                            await this.apiClient.uploadKml(file);

                            // Markiere als synchronisiert
                            localKml.syncedToServer = true;
                            await this.saveKmlLocal(localKml);
                            uploaded++;
                        } catch (error) {
                            console.error(`Fehler beim Upload von ${localKml.filename}:`, error);
                        }
                    }
                }
            }

            // Download Server-Dateien, die nicht lokal sind
            for (const serverKml of serverKmls) {
                const localHasFile = localKmls.some(lk => lk.filename === serverKml.filename);

                if (!localHasFile) {
                    try {
                        const response = await this.apiClient.downloadKml(serverKml.filename);

                        await this.saveKmlLocal({
                            filename: serverKml.filename,
                            content: response.content,
                            size: serverKml.size,
                            uploaded: serverKml.modified,
                            syncedToServer: true
                        });

                        downloaded++;
                    } catch (error) {
                        console.error(`Fehler beim Download von ${serverKml.filename}:`, error);
                    }
                }
            }

            return {
                success: true,
                uploaded: uploaded,
                downloaded: downloaded,
                message: `Sync abgeschlossen: ${uploaded} hochgeladen, ${downloaded} heruntergeladen`
            };

        } catch (error) {
            console.error('Fehler beim Synchronisieren:', error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    /**
     * Parst KML-Inhalt und extrahiert Koordinaten
     * @param {string} kmlContent - KML-XML-Inhalt
     * @returns {Array} - Array von Polygon-Koordinaten
     */
    parseKmlCoordinates(kmlContent) {
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(kmlContent, 'text/xml');

            const polygons = [];

            // Suche nach Placemarks mit Polygonen
            const placemarks = xmlDoc.getElementsByTagName('Placemark');

            console.log(`[KML-Parser] ${placemarks.length} Placemarks gefunden`);
            console.log(`[KML-Parser] KML-Content Länge: ${kmlContent.length} Zeichen`);

            for (let i = 0; i < placemarks.length; i++) {
                const placemark = placemarks[i];

                // Name des Placemarks
                const nameElement = placemark.getElementsByTagName('name')[0];
                const placemarkName = nameElement ? nameElement.textContent.trim() : `Unbenannt ${i + 1}`;

                // Description extrahieren
                const descriptionElement = placemark.getElementsByTagName('description')[0];
                const description = descriptionElement ? descriptionElement.textContent.trim() : null;

                // Style extrahieren
                const placemarkStyle = this.extractStyle(placemark);

                console.log(`[KML-Parser] Verarbeite Placemark ${i + 1}/${placemarks.length}: "${placemarkName}"`);
                if (description) {
                    console.log(`[KML-Parser]   -> Description: "${description}"`);
                }
                if (Object.keys(placemarkStyle).length > 0) {
                    console.log(`[KML-Parser]   -> Style gefunden:`, placemarkStyle);
                }

                // Sammle alle Polygon-Elemente (egal wo sie verschachtelt sind)
                const polygonElements = placemark.getElementsByTagName('Polygon');

                console.log(`[KML-Parser]   -> ${polygonElements.length} Polygon-Elemente gefunden`);

                // Verarbeite jedes Polygon
                for (let j = 0; j < polygonElements.length; j++) {
                    const polygonElement = polygonElements[j];

                    // Suche nach coordinates in outerBoundaryIs oder direkt im Polygon
                    let coordsElement = null;

                    // Methode 1: outerBoundaryIs > LinearRing > coordinates
                    const outerBoundary = polygonElement.getElementsByTagName('outerBoundaryIs')[0];
                    if (outerBoundary) {
                        const linearRing = outerBoundary.getElementsByTagName('LinearRing')[0];
                        if (linearRing) {
                            coordsElement = linearRing.getElementsByTagName('coordinates')[0];
                            console.log(`[KML-Parser]   -> Polygon ${j + 1}: gefunden via outerBoundaryIs/LinearRing`);
                        }
                    }

                    // Methode 2: Direkt coordinates im Polygon
                    if (!coordsElement) {
                        coordsElement = polygonElement.getElementsByTagName('coordinates')[0];
                        if (coordsElement) {
                            console.log(`[KML-Parser]   -> Polygon ${j + 1}: gefunden via direktes coordinates`);
                        }
                    }

                    if (coordsElement) {
                        const coordsText = coordsElement.textContent.trim();
                        console.log(`[KML-Parser]   -> Koordinaten-Text Länge: ${coordsText.length} Zeichen`);

                        const coords = this.parseCoordinatesText(coordsText);

                        if (coords.length > 0) {
                            // Bei mehreren Polygonen füge Nummer zum Namen hinzu
                            const polygonName = polygonElements.length > 1
                                ? `${placemarkName} (${j + 1})`
                                : placemarkName;

                            console.log(`[KML-Parser]   -> ✓ Polygon "${polygonName}" mit ${coords.length} Koordinaten hinzugefügt`);

                            polygons.push({
                                name: polygonName,
                                description: description,
                                coordinates: coords,
                                style: placemarkStyle
                            });
                        } else {
                            console.warn(`[KML-Parser]   -> ✗ Polygon ${j + 1}: Keine gültigen Koordinaten gefunden!`);
                        }
                    } else {
                        console.warn(`[KML-Parser]   -> ✗ Polygon ${j + 1}: Kein coordinates-Element gefunden!`);
                    }
                }

                // Falls keine Polygon-Elemente gefunden wurden, prüfe auf andere Geometrien
                if (polygonElements.length === 0) {
                    const hasPoint = placemark.getElementsByTagName('Point').length > 0;
                    const hasLineString = placemark.getElementsByTagName('LineString').length > 0;

                    if (hasPoint || hasLineString) {
                        console.log(`[KML-Parser]   -> Placemark enthält ${hasPoint ? 'Point' : 'LineString'} (wird übersprungen)`);
                    } else {
                        console.warn(`[KML-Parser]   -> Placemark enthält keine erkannten Geometrien!`);
                    }
                }
            }

            console.log(`[KML-Parser] ═══════════════════════════════════════`);
            console.log(`[KML-Parser] ✓ ZUSAMMENFASSUNG: ${polygons.length} Polygone insgesamt extrahiert`);
            console.log(`[KML-Parser] ═══════════════════════════════════════`);

            return polygons;
        } catch (error) {
            console.error('[KML-Parser] ✗ FEHLER beim Parsen der KML-Datei:', error);
            return [];
        }
    }

    /**
     * Parst Koordinaten-Text aus KML
     * @param {string} coordsText - Koordinaten-Text
     * @returns {Array} - Array von [lng, lat] Paaren
     */
    parseCoordinatesText(coordsText) {
        const coords = [];
        const points = coordsText.trim().split(/\s+/);

        for (let point of points) {
            const [lng, lat, alt] = point.split(',');
            if (lng && lat) {
                coords.push([parseFloat(lng), parseFloat(lat)]);
            }
        }

        return coords;
    }

    /**
     * Konvertiert KML-Farbe (AABBGGRR) zu CSS Hex (#RRGGBB)
     * @param {string} kmlColor - KML-Farbe im Format AABBGGRR
     * @returns {string} - CSS Hex-Farbe
     */
    convertKmlColor(kmlColor) {
        if (!kmlColor || kmlColor.length !== 8) {
            return null;
        }

        // KML Format: AABBGGRR
        const aa = kmlColor.substring(0, 2); // Alpha
        const bb = kmlColor.substring(2, 4); // Blue
        const gg = kmlColor.substring(4, 6); // Green
        const rr = kmlColor.substring(6, 8); // Red

        // CSS Format: #RRGGBB
        return `#${rr}${gg}${bb}`;
    }

    /**
     * Extrahiert Style-Informationen aus einem Placemark
     * @param {Element} placemark - Placemark XML-Element
     * @returns {Object} - Style-Objekt mit color, fillOpacity, weight
     */
    extractStyle(placemark) {
        const style = {};

        const styleElement = placemark.getElementsByTagName('Style')[0];
        if (!styleElement) {
            return style;
        }

        // LineStyle (Randfarbe und Dicke)
        const lineStyle = styleElement.getElementsByTagName('LineStyle')[0];
        if (lineStyle) {
            const colorElement = lineStyle.getElementsByTagName('color')[0];
            const widthElement = lineStyle.getElementsByTagName('width')[0];

            if (colorElement) {
                const kmlColor = colorElement.textContent.trim();
                style.color = this.convertKmlColor(kmlColor);
            }

            if (widthElement) {
                style.weight = parseFloat(widthElement.textContent);
            }
        }

        // PolyStyle (Füllfarbe und Transparenz)
        const polyStyle = styleElement.getElementsByTagName('PolyStyle')[0];
        if (polyStyle) {
            const colorElement = polyStyle.getElementsByTagName('color')[0];
            if (colorElement) {
                const kmlColor = colorElement.textContent.trim();
                // Alpha-Kanal für fillOpacity verwenden
                const alpha = parseInt(kmlColor.substring(0, 2), 16);
                style.fillOpacity = alpha / 255;
            }
        }

        return style;
    }
}

// Singleton-Instanz erstellen
const kmlManager = new KmlManager();

// Exportieren
window.kmlManager = kmlManager;
