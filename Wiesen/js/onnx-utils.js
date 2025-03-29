/**
 * Lädt ein ONNX-Modell mit ONNX Runtime Web
 * @param {string} path - Pfad zum Modell
 * @param {function} progressCallback - Callback-Funktion für Fortschrittsanzeige
 * @returns {Promise<Object>} - Eine Promise, die mit der ONNX-Session aufgelöst wird
 */
async function loadONNXModel(path, progressCallback = null) {
    try {
        // Prüfen, ob ONNX Runtime Web verfügbar ist (window.ort)
        if (typeof window.ort === 'undefined') {
            console.warn("ONNX Runtime Web nicht gefunden, versuche es als onnxruntime zu laden");
            
            // Versuche alternative Namen, unter denen die Bibliothek verfügbar sein könnte
            if (typeof window.onnxruntime !== 'undefined') {
                window.ort = window.onnxruntime;
            } else if (typeof window.ONNXRuntime !== 'undefined') {
                window.ort = window.ONNXRuntime;
            } else {
                // Wenn die Bibliothek nicht geladen wurde, dynamisch laden
                await loadONNXRuntimeDynamically();
                
                // Prüfen, ob das Laden erfolgreich war
                if (typeof window.ort === 'undefined') {
                    throw new Error("ONNX Runtime Web konnte nicht geladen werden. Bitte füge <script src='https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js'></script> zu deiner HTML-Datei hinzu.");
                }
            }
        }
        
        console.log("ONNX Runtime Web-Version:", window.ort.version);
        
        // ONNX-Sitzungsoptionen erstellen
        const sessionOptions = {};
        
        // WebGL-Backend verwenden, wenn verfügbar (für bessere Performance)
        if (window.ort.env && window.ort.webgl) {
            console.log("Verwende WebGL-Backend für ONNX Runtime");
            sessionOptions.executionProviders = ['webgl'];
        }
        
        // Fortschrittsanzeige hinzufügen, wenn ein Callback vorhanden ist
        if (progressCallback) {
            let lastReportedProgress = 0;
            
            // Fetch mit Fortschrittsanzeige verwenden
            const response = await fetch(path);
            
            if (!response.ok) {
                throw new Error(`HTTP-Fehler beim Laden des Modells: ${response.status} ${response.statusText}`);
            }
            
            // Überprüfe, ob der Content-Length-Header vorhanden ist
            const contentLength = response.headers.get('Content-Length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            
            // ReadableStream und Reader für Fortschrittsanzeige verwenden
            const reader = response.body.getReader();
            let receivedLength = 0;
            let chunks = [];
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }
                
                chunks.push(value);
                receivedLength += value.length;
                
                // Fortschritt berechnen und anzeigen
                if (total && progressCallback) {
                    const progress = Math.min(99, Math.round((receivedLength / total) * 100));
                    
                    // Nur melden, wenn sich der Fortschritt wesentlich geändert hat
                    if (progress >= lastReportedProgress + 5 || progress === 99) {
                        progressCallback(progress, "ONNX-Modell");
                        lastReportedProgress = progress;
                    }
                }
            }
            
            // Chunks zu einem ArrayBuffer zusammenführen
            const modelData = new Uint8Array(receivedLength);
            let position = 0;
            
            for (const chunk of chunks) {
                modelData.set(chunk, position);
                position += chunk.length;
            }
            
            // ONNX-Sitzung erstellen
            console.log("Erstelle ONNX-Sitzung aus ArrayBuffer");
            const session = await window.ort.InferenceSession.create(modelData.buffer, sessionOptions);
            
            // 100% Fortschritt anzeigen
            if (progressCallback) {
                progressCallback(100, "ONNX-Modell");
            }
            
            return session;
        } else {
            // Einfaches Laden ohne Fortschrittsanzeige
            console.log("Lade ONNX-Modell von:", path);
            const session = await window.ort.InferenceSession.create(path, sessionOptions);
            return session;
        }
    } catch (error) {
        console.error("Fehler beim Laden des ONNX-Modells:", error);
        throw error;
    }
}

/**
 * Lädt ONNX Runtime Web dynamisch
 * @returns {Promise<void>}
 */
async function loadONNXRuntimeDynamically() {
    return new Promise((resolve, reject) => {
        console.log("Versuche, ONNX Runtime Web dynamisch zu laden");
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js';
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
            console.log("ONNX Runtime Web erfolgreich dynamisch geladen");
            resolve();
        };
        
        script.onerror = () => {
            console.error("Fehler beim dynamischen Laden von ONNX Runtime Web");
            reject(new Error("Konnte ONNX Runtime Web nicht dynamisch laden"));
        };
        
        document.head.appendChild(script);
    });
}

/**
 * Führt eine Inferenz mit einem ONNX-Modell durch
 * @param {Object} session - ONNX-Sitzung
 * @param {Object} inputs - Eingabedaten für das Modell
 * @returns {Promise<Object>} - Ausgabe des Modells
 */
async function runONNXInference(session, inputs) {
    try {
        // Inferenz-Ausführung mit ONNX Runtime
        console.log("Führe ONNX-Inferenz aus mit Eingaben:", Object.keys(inputs));
        const outputMap = await session.run(inputs);
        
        // ONNX-Ausgabe verarbeiten
        const outputs = {};
        
        // Alle Ausgabe-Tensoren durchgehen
        for (const outputName in outputMap) {
            const outputTensor = outputMap[outputName];
            
            // Tensor-Daten abrufen
            if (outputTensor && outputTensor.data) {
                outputs[outputName] = {
                    data: outputTensor.data,
                    dims: outputTensor.dims
                };
            }
        }
        
        return outputs;
    } catch (error) {
        console.error("Fehler bei der ONNX-Inferenz:", error);
        throw error;
    }
}

/**
 * Bereitet ein Bild für die Verarbeitung mit einem SAM-Modell vor
 * @param {string|HTMLImageElement|HTMLCanvasElement} image - Bilddaten (URL, Image-Element oder Canvas-Element)
 * @param {number} targetSize - Zielgröße für die Bildverarbeitung
 * @returns {Promise<Object>} - Vorverarbeitetes Bild mit Tensor und Dimensionen
 */
async function preprocessImageForONNX(image, targetSize = 1024) {
    try {
        // Bild in ein HTMLImageElement umwandeln, falls es noch keines ist
        let imgElement;
        
        if (typeof image === 'string') {
            // Bild-URL
            imgElement = new Image();
            imgElement.crossOrigin = 'anonymous';
            
            // Auf das Laden des Bildes warten
            await new Promise((resolve, reject) => {
                imgElement.onload = resolve;
                imgElement.onerror = () => reject(new Error('Fehler beim Laden des Bildes'));
                imgElement.src = image;
            });
        } else if (image instanceof HTMLImageElement) {
            // Bereits ein Image-Element
            imgElement = image;
        } else if (image instanceof HTMLCanvasElement) {
            // Canvas-Element
            const dataURL = image.toDataURL('image/png');
            return await preprocessImageForONNX(dataURL, targetSize);
        } else {
            throw new Error('Nicht unterstützter Bildtyp');
        }
        
        // Canvas für die Bildverarbeitung erstellen
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Originalbild-Dimensionen
        const originalWidth = imgElement.width;
        const originalHeight = imgElement.height;
        
        // Zielgröße berechnen, wobei das Seitenverhältnis erhalten bleibt
        let resizeWidth, resizeHeight;
        
        if (originalWidth > originalHeight) {
            resizeWidth = targetSize;
            resizeHeight = Math.round((originalHeight / originalWidth) * targetSize);
        } else {
            resizeHeight = targetSize;
            resizeWidth = Math.round((originalWidth / originalHeight) * targetSize);
        }
        
        // Canvas-Größe setzen
        canvas.width = resizeWidth;
        canvas.height = resizeHeight;
        
        // Bild auf Canvas zeichnen
        ctx.drawImage(imgElement, 0, 0, resizeWidth, resizeHeight);
        
        // Bilddaten abrufen
        const imageData = ctx.getImageData(0, 0, resizeWidth, resizeHeight);
        const pixels = imageData.data;
        
        // Float32Array für die Bildpixel erstellen (RGB-Format)
        // SAM erwartet Bilder im Format [B, C, H, W] mit Werten im Bereich [0, 255]
        const tensorSize = 3 * resizeHeight * resizeWidth;
        const imageTensor = new Float32Array(tensorSize);
        
        // Pixel in das richtige Format umwandeln
        let tensorIdx = 0;
        
        // Für SAM-Modelle müssen die Kanäle getrennt sein (alle R, dann alle G, dann alle B)
        // R-Kanal
        for (let y = 0; y < resizeHeight; y++) {
            for (let x = 0; x < resizeWidth; x++) {
                const pixelIdx = (y * resizeWidth + x) * 4;
                imageTensor[tensorIdx++] = pixels[pixelIdx]; // R
            }
        }
        
        // G-Kanal
        for (let y = 0; y < resizeHeight; y++) {
            for (let x = 0; x < resizeWidth; x++) {
                const pixelIdx = (y * resizeWidth + x) * 4;
                imageTensor[tensorIdx++] = pixels[pixelIdx + 1]; // G
            }
        }
        
        // B-Kanal
        for (let y = 0; y < resizeHeight; y++) {
            for (let x = 0; x < resizeWidth; x++) {
                const pixelIdx = (y * resizeWidth + x) * 4;
                imageTensor[tensorIdx++] = pixels[pixelIdx + 2]; // B
            }
        }
        
        // Rückgabewert mit Tensor und Metadaten
        return {
            tensor: imageTensor,
            dims: [1, 3, resizeHeight, resizeWidth], // Batch, Channels, Height, Width
            width: resizeWidth,
            height: resizeHeight,
            originalWidth,
            originalHeight
        };
    } catch (error) {
        console.error("Fehler bei der Bildvorverarbeitung:", error);
        throw error;
    }
}

/**
 * Verarbeitet Klick-Prompts für SAM-Modelle
 * @param {Array} points - Array von Punkten mit x, y, label
 * @param {number} imageWidth - Bildbreite
 * @param {number} imageHeight - Bildhöhe
 * @returns {Object} - Vorbereitete Eingabedaten für das SAM-Modell
 */
function preparePointsForSAM(points, imageWidth, imageHeight) {
    // SAM erwartet Punkt-Koordinaten im Format [N, 2]
    const pointCoords = new Float32Array(points.length * 2);
    const pointLabels = new Float32Array(points.length);
    
    // Punkt-Daten in die Arrays kopieren
    for (let i = 0; i < points.length; i++) {
        const point = points[i];
        
        // Koordinaten auf die Bildgröße normalisieren
        pointCoords[i * 2] = point.x * imageWidth;
        pointCoords[i * 2 + 1] = point.y * imageHeight;
        
        // Label (1 für Vordergrund, 0 für Hintergrund)
        pointLabels[i] = point.label || 1;
    }
    
    return {
        point_coords: pointCoords,
        point_labels: pointLabels
    };
}

/**
 * Verarbeitet Masken-Ausgabe von SAM zu Polygon-Punkten
 * @param {Object} output - Ausgabe des SAM-Modells
 * @param {Array} bounds - Kartenansicht-Grenzen [nw, se]
 * @param {number} imageWidth - Bildbreite
 * @param {number} imageHeight - Bildhöhe
 * @returns {Array} - Array von Polygon-Punkten
 */
function processMaskToPolygon(output, bounds, imageWidth, imageHeight) {
    try {
        // Sicherstellen, dass die erforderlichen Ausgaben vorhanden sind
        if (!output || !output.masks || !output.masks.data) {
            throw new Error("Ungültiges Ausgabeformat: Masken nicht gefunden");
        }
        
        // Dimensionen der Maskenausgabe abrufen
        const maskData = output.masks.data;
        const maskDims = output.masks.dims;
        
        if (!maskDims || maskDims.length < 3) {
            throw new Error("Ungültiges Maskenformat: Falsche Dimensionen");
        }
        
        // Maskendimensionen extrahieren
        const maskHeight = maskDims[1];
        const maskWidth = maskDims[2];
        
        // Binärmaske aus der SAM-Ausgabe extrahieren
        // SAM gibt normalerweise eine Wahrscheinlichkeitskarte zurück, die wir binarisieren müssen
        const binaryMask = new Uint8Array(maskHeight * maskWidth);
        
        // Schwellenwert für die Binarisierung
        const threshold = 0.5;
        
        for (let i = 0; i < maskHeight * maskWidth; i++) {
            binaryMask[i] = maskData[i] > threshold ? 1 : 0;
        }
        
        // Konturpunkte aus der Maske ableiten
        // Vereinfachte Implementierung: Wir nehmen nur die Randpunkte der Maske
        const contourPoints = [];
        
        // Kartengrenzen für die Geotransformation
        const nw = bounds[0];
        const se = bounds[1];
        const lonRange = se[1] - nw[1];
        const latRange = nw[0] - se[0];
        
        // Gitterraster über die Maske legen und Randpunkte finden
        const gridSize = 20; // Anzahl der zu prüfenden Punkte in jeder Richtung
        
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const maskX = Math.floor((x / gridSize) * maskWidth);
                const maskY = Math.floor((y / gridSize) * maskHeight);
                
                // Prüfen, ob dieser Punkt zur Maske gehört
                const idx = maskY * maskWidth + maskX;
                if (binaryMask[idx] === 1) {
                    // Konvertiere Bildkoordinaten in geografische Koordinaten
                    const lonNorm = maskX / maskWidth;
                    const latNorm = maskY / maskHeight;
                    
                    const lon = nw[1] + lonNorm * lonRange;
                    const lat = nw[0] - latNorm * latRange;
                    
                    contourPoints.push([lat, lon]);
                }
            }
        }
        
        // Konvexe Hülle der Punkte berechnen, um ein sauberes Polygon zu erhalten
        const hull = computeConvexHull(contourPoints);
        
        // Polygon schließen
        if (hull.length > 0 && (hull[0][0] !== hull[hull.length - 1][0] || hull[0][1] !== hull[hull.length - 1][1])) {
            hull.push([...hull[0]]);
        }
        
        return hull;
    } catch (error) {
        console.error("Fehler bei der Maskenverarbeitung:", error);
        throw error;
    }
}

/**
 * Berechnet die konvexe Hülle für eine Menge von Punkten (Graham-Scan-Algorithmus)
 * @param {Array} points - Array von Punkten [lat, lng]
 * @returns {Array} - Konvexe Hülle als Array von Punkten
 */
function computeConvexHull(points) {
    if (points.length <= 3) return [...points];
    
    // Sortiere Punkte nach X-Koordinate
    points.sort((a, b) => a[1] - b[1]);
    
    // Untere Hülle
    const lowerHull = [];
    for (let i = 0; i < points.length; i++) {
        while (
            lowerHull.length >= 2 &&
            !isCounterClockwise(
                lowerHull[lowerHull.length - 2],
                lowerHull[lowerHull.length - 1],
                points[i]
            )
        ) {
            lowerHull.pop();
        }
        lowerHull.push(points[i]);
    }
    
    // Obere Hülle
    const upperHull = [];
    for (let i = points.length - 1; i >= 0; i--) {
        while (
            upperHull.length >= 2 &&
            !isCounterClockwise(
                upperHull[upperHull.length - 2],
                upperHull[upperHull.length - 1],
                points[i]
            )
        ) {
            upperHull.pop();
        }
        upperHull.push(points[i]);
    }
    
    // Obere und untere Hülle zusammenführen (ohne Duplikate)
    upperHull.pop();
    lowerHull.pop();
    return [...lowerHull, ...upperHull];
}

/**
 * Prüft, ob drei Punkte gegen den Uhrzeigersinn angeordnet sind
 * @param {Array} p1 - Erster Punkt [lat, lng]
 * @param {Array} p2 - Zweiter Punkt [lat, lng]
 * @param {Array} p3 - Dritter Punkt [lat, lng]
 * @returns {boolean} - True, wenn gegen den Uhrzeigersinn
 */
function isCounterClockwise(p1, p2, p3) {
    return (p2[1] - p1[1]) * (p3[0] - p2[0]) - (p2[0] - p1[0]) * (p3[1] - p2[1]) > 0;
}

// Export für Modulnutzung
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        loadONNXModel,
        runONNXInference,
        preprocessImageForONNX,
        preparePointsForSAM,
        processMaskToPolygon
    };
}