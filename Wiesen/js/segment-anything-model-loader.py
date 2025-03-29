// Modellverwaltung für Segment Anything
class SegmentAnythingModelManager {
    constructor() {
        this.models = {};
        this.activeModel = null;
        this.modelStatus = {}; // Status für jedes Modell (loading, loaded, error)
        this.availableModels = {
            "mobilesam-onnx": {
                name: "MobileSAM (ONNX)",
                type: "onnx",
                files: ["mobile_sam.onnx"],
                size: "9.5MB",
                description: "Leichtgewichtiges Modell für schnelle Segmentierung",
                path: "./models/segment-anything-lite/mobilesam/"
            },
            "tinysam-onnx": {
                name: "TinySAM (ONNX)",
                type: "onnx",
                files: ["tinysam.onnx"],
                size: "3.9MB",
                description: "Extrem kleines Modell für eingeschränkte Umgebungen",
                path: "./models/segment-anything-lite/tinysam/"
            },
            "edgesam-tfjs": {
                name: "EdgeSAM (TFJS)",
                type: "tfjs",
                files: ["model.json", "group1-shard1of3.bin", "group1-shard2of3.bin", "group1-shard3of3.bin"],
                size: "13.2MB",
                description: "Für TensorFlow.js optimiertes Modell",
                path: "./models/segment-anything-lite/edgesam-tfjs/"
            }
        };
    }

    // Verfügbare Modelle auflisten
    listAvailableModels() {
        return this.availableModels;
    }

    // Status eines Modells prüfen
    getModelStatus(modelId) {
        return this.modelStatus[modelId] || 'not-loaded';
    }

    // Funktion zum Laden eines Modells
    async loadModel(modelId, progressCallback = null) {
        if (this.models[modelId]) {
            console.log(`Modell ${modelId} bereits geladen`);
            this.activeModel = modelId;
            return this.models[modelId];
        }

        if (!this.availableModels[modelId]) {
            throw new Error(`Unbekanntes Modell: ${modelId}`);
        }

        const modelInfo = this.availableModels[modelId];

        try {
            this.modelStatus[modelId] = 'loading';
            if (progressCallback) progressCallback(0, modelInfo.name);
            
            let model;
            
            // Je nach Modelltyp laden
            if (modelInfo.type === 'onnx') {
                if (!window.ort) {
                    throw new Error("ONNX Runtime ist nicht geladen. Bitte füge <script src='https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js'></script> zum HTML hinzu.");
                }
                
                model = await this.loadONNXModel(modelInfo, progressCallback);
            } else if (modelInfo.type === 'tfjs') {
                if (!window.tf) {
                    throw new Error("TensorFlow.js ist nicht geladen. Bitte füge <script src='https://cdn.jsdelivr.net/npm/@tensorflow/tfjs/dist/tf.min.js'></script> zum HTML hinzu.");
                }
                
                model = await this.loadTFJSModel(modelInfo, progressCallback);
            } else {
                throw new Error(`Nicht unterstützter Modelltyp: ${modelInfo.type}`);
            }
            
            // Modell speichern und aktivieren
            this.models[modelId] = model;
            this.activeModel = modelId;
            this.modelStatus[modelId] = 'loaded';
            
            if (progressCallback) progressCallback(100, modelInfo.name);
            
            console.log(`Modell ${modelId} erfolgreich geladen`);
            return model;
        } catch (error) {
            this.modelStatus[modelId] = 'error';
            console.error(`Fehler beim Laden des Modells ${modelId}:`, error);
            throw error;
        }
    }

    // ONNX-Modell laden
    async loadONNXModel(modelInfo, progressCallback) {
        try {
            // ONNX Runtime initialisieren
            const ort = window.ort;
            
            // Pfad zum Modell
            const modelPath = `${modelInfo.path}${modelInfo.files[0]}`;
            
            // Fortschrittsanzeige vorbereiten
            const options = {};
            
            if (progressCallback) {
                options.onProgress = (progress) => {
                    progressCallback(progress * 100, modelInfo.name);
                };
            }
            
            // ONNX-Sitzung erstellen
            console.log(`Lade ONNX-Modell von ${modelPath}`);
            const session = await ort.InferenceSession.create(modelPath, options);
            
            // Metadaten zum Modell hinzufügen
            return {
                session: session,
                type: 'onnx',
                info: modelInfo
            };
        } catch (error) {
            console.error("Fehler beim Laden des ONNX-Modells:", error);
            throw error;
        }
    }

    // TensorFlow.js-Modell laden
    async loadTFJSModel(modelInfo, progressCallback) {
        try {
            // TensorFlow.js initialisieren
            const tf = window.tf;
            
            // Pfad zum Modell
            const modelPath = `${modelInfo.path}${modelInfo.files[0]}`;
            
            // Fortschrittsanzeige einrichten
            if (progressCallback) {
                // Leider bietet TF.js keine direkte Fortschrittsüberwachung
                // Wir simulieren Fortschritt
                const simulateProgress = () => {
                    let progress = 0;
                    const interval = setInterval(() => {
                        progress += 5;
                        if (progress <= 90) {
                            progressCallback(progress, modelInfo.name);
                        } else {
                            clearInterval(interval);
                        }
                    }, 100);
                    return interval;
                };
                
                const progressInterval = simulateProgress();
                
                // Modell laden
                console.log(`Lade TFJS-Modell von ${modelPath}`);
                const model = await tf.loadGraphModel(modelPath);
                
                // Fortschrittsintervall stoppen und 100% anzeigen
                clearInterval(progressInterval);
                progressCallback(100, modelInfo.name);
                
                // Metadaten zum Modell hinzufügen
                return {
                    model: model,
                    type: 'tfjs',
                    info: modelInfo
                };
            } else {
                // Modell ohne Fortschrittsanzeige laden
                console.log(`Lade TFJS-Modell von ${modelPath}`);
                const model = await tf.loadGraphModel(modelPath);
                
                // Metadaten zum Modell hinzufügen
                return {
                    model: model,
                    type: 'tfjs',
                    info: modelInfo
                };
            }
        } catch (error) {
            console.error("Fehler beim Laden des TFJS-Modells:", error);
            throw error;
        }
    }

    // Aktives Modell auswählen
    setActiveModel(modelId) {
        if (!this.models[modelId]) {
            throw new Error(`Modell ${modelId} ist nicht geladen`);
        }
        this.activeModel = modelId;
    }

    // Aktives Modell abrufen
    getActiveModel() {
        if (!this.activeModel || !this.models[this.activeModel]) {
            return null;
        }
        return this.models[this.activeModel];
    }

    // Bild segmentieren mit aktivem Modell
    async segmentImage(imageData, pointPrompts) {
        const activeModel = this.getActiveModel();
        if (!activeModel) {
            throw new Error("Kein aktives Modell verfügbar");
        }

        console.log(`Führe Segmentierung mit Modell ${this.activeModel} durch`);
        
        try {
            if (activeModel.type === 'onnx') {
                return await this.segmentWithONNX(activeModel, imageData, pointPrompts);
            } else if (activeModel.type === 'tfjs') {
                return await this.segmentWithTFJS(activeModel, imageData, pointPrompts);
            } else {
                throw new Error(`Nicht unterstützter Modelltyp: ${activeModel.type}`);
            }
        } catch (error) {
            console.error("Segmentierungsfehler:", error);
            throw error;
        }
    }

    // Segmentierung mit ONNX-Modell
    async segmentWithONNX(model, imageData, pointPrompts) {
        const session = model.session;
        
        // Bildvorverarbeitung für SAM
        const preprocessedImage = await this.preprocessImageForSAM(imageData);
        
        // Prompt-Verarbeitung
        const promptInputs = this.processPointPrompts(pointPrompts, preprocessedImage.width, preprocessedImage.height);
        
        // ONNX Eingabedaten vorbereiten
        const inputs = {
            "image": preprocessedImage.tensor,
            "point_coords": promptInputs.coordinates,
            "point_labels": promptInputs.labels
        };
        
        // Inferenz durchführen
        console.log("ONNX Inferenz starten...");
        const results = await session.run(inputs);
        
        // Maskendaten extrahieren und verarbeiten
        return this.processMaskOutput(results, preprocessedImage.width, preprocessedImage.height);
    }

    // Segmentierung mit TensorFlow.js
    async segmentWithTFJS(model, imageData, pointPrompts) {
        const tfModel = model.model;
        
        // Bildvorverarbeitung für SAM
        const preprocessedImage = await this.preprocessImageForSAM(imageData, true);
        
        // Prompt-Verarbeitung
        const promptInputs = this.processPointPrompts(pointPrompts, preprocessedImage.width, preprocessedImage.height, true);
        
        // TF.js Inferenz durchführen
        console.log("TensorFlow.js Inferenz starten...");
        const maskTensor = tfModel.predict([
            preprocessedImage.tensor, 
            promptInputs.coordinates, 
            promptInputs.labels
        ]);
        
        // Maskendaten extrahieren und verarbeiten
        const maskData = await maskTensor.data();
        const maskShape = maskTensor.shape;
        
        // Speicher freigeben
        tf.dispose(maskTensor);
        
        // Maske verarbeiten
        return this.processMaskOutput(
            { masks: maskData }, 
            maskShape[1], 
            maskShape[2]
        );
    }

    // Bildvorverarbeitung für SAM
    async preprocessImageForSAM(imageData, isTFJS = false) {
        // Implementierung der Bildvorverarbeitung
        // Dies ist ein Platzhalter - die tatsächliche Implementierung 
        // hängt von den spezifischen Anforderungen des Modells ab
        
        console.log("Bildvorverarbeitung für SAM...");
        
        // Beispiel-Implementierung (Platzhalter)
        if (isTFJS) {
            // TensorFlow.js-spezifische Vorverarbeitung
            const tf = window.tf;
            
            // Bildtensor erstellen
            // Dies ist vereinfacht - tatsächliche Implementierung wäre modellspezifisch
            const imageTensor = tf.tensor(new Float32Array([0, 0, 0]), [1, 1, 3]);
            
            return {
                tensor: imageTensor,
                width: 1,
                height: 1
            };
        } else {
            // ONNX-spezifische Vorverarbeitung
            // Dies ist vereinfacht - tatsächliche Implementierung wäre modellspezifisch
            const tensor = new Float32Array([0, 0, 0]);
            
            return {
                tensor: tensor,
                width: 1,
                height: 1
            };
        }
    }

    // Punktprompts verarbeiten
    processPointPrompts(pointPrompts, imageWidth, imageHeight, isTFJS = false) {
        // Implementierung der Prompt-Verarbeitung
        // Dies ist ein Platzhalter - die tatsächliche Implementierung
        // hängt von den spezifischen Anforderungen des Modells ab
        
        console.log("Verarbeite Punktprompts...");
        
        // Beispiel-Implementierung (Platzhalter)
        if (isTFJS) {
            // TensorFlow.js-spezifische Verarbeitung
            const tf = window.tf;
            
            // Koordinaten- und Label-Tensoren erstellen
            const coordsTensor = tf.tensor([[0, 0]]);
            const labelsTensor = tf.tensor([1]);
            
            return {
                coordinates: coordsTensor,
                labels: labelsTensor
            };
        } else {
            // ONNX-spezifische Verarbeitung
            const coordinates = new Float32Array([0, 0]);
            const labels = new Float32Array([1]);
            
            return {
                coordinates: coordinates,
                labels: labels
            };
        }
    }

    // Ausgabe des Modells in Polygon-Maske umwandeln
    processMaskOutput(results, width, height) {
        // Implementierung der Maskenverarbeitung
        // Dies ist ein Platzhalter - die tatsächliche Implementierung
        // hängt von den spezifischen Ausgabeformaten des Modells ab
        
        console.log("Verarbeite Maskenausgabe...");
        
        // Beispiel-Implementierung (Platzhalter)
        // Zufälliges Polygon für Testzwecke generieren
        return this.generateRandomPolygon(10);
    }

    // Hilfsfunktion: Zufälliges Polygon generieren (für Testzwecke)
    generateRandomPolygon(numPoints) {
        const points = [];
        const center = { x: 0.5, y: 0.5 };
        const radius = 0.3;
        
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * 2 * Math.PI;
            const x = center.x + radius * Math.cos(angle);
            const y = center.y + radius * Math.sin(angle);
            points.push([x, y]);
        }
        
        // Polygon schließen
        points.push([...points[0]]);
        
        return points;
    }
}

// Modellmanager initialisieren
window.segmentAnythingModelManager = new SegmentAnythingModelManager();