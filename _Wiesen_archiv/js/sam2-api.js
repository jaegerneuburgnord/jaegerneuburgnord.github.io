/**
 * SAM2 API adapter für Labelbox SAM2 model
 * Diese Version ist speziell für die Hiera Tiny Modelle angepasst
 */

class SAM2API {
    constructor(config = window.SAM2_CONFIG) {
        this.config = config || {};
        this.initialized = false;
        this.isLoading = false;
        this.progress = 0;
        this.modelState = 'unloaded';  // unloaded, loading, loaded, error
        
        // Model instances
        this.model = null;  // decoder
        this.encoder = null;
        
        // Performance tracking
        this.timing = {
            loadTime: 0,
            preprocessTime: 0,
            inferenceTime: 0,
            postprocessTime: 0
        };
        
        // Event handlers
        this.eventHandlers = {
            onProgress: [],
            onStateChange: [],
            onError: []
        };
        
        // Debug logging
        this.debug = this.config.debug?.enabled || false;
    }
    
    /**
     * Initialize the SAM2 models
     * @returns {Promise<boolean>} Whether initialization was successful
     */
    async initialize() {
        if (this.initialized) {
            this.log("SAM2 already initialized");
            return true;
        }
        
        if (this.isLoading) {
            this.log("SAM2 is already loading");
            return false;
        }
        
        try {
            this.isLoading = true;
            this._setState('loading');
            
            const startTime = performance.now();
            
            // Ensure ONNX Runtime is available
            await this._ensureONNXRuntime();
            
            // Configure session options
            const sessionOptions = {
                executionProviders: [this.config.model?.backend || 'webgl']
            };
            
            // Load models in parallel
            this._updateProgress(5, "Starting model download...");
            
            const [decoder, encoder] = await Promise.all([
                // Decoder model (70% of progress) - for Hiera Tiny, this is the decoder
                this._loadModelWithProgress(
                    this.config.model?.modelUrl || './models/mobilesam/sam2_hiera_tiny.decoder.onnx',
                    sessionOptions,
                    (progress) => {
                        const scaledProgress = 5 + progress * 70;
                        this._updateProgress(scaledProgress, "Loading decoder model...");
                    }
                ),
                
                // Encoder model (25% of progress)
                this._loadModelWithProgress(
                    this.config.model?.encoderUrl || './models/mobilesam/sam2_hiera_tiny.encoder.ort',
                    sessionOptions,
                    (progress) => {
                        const scaledProgress = 75 + progress * 25;
                        this._updateProgress(scaledProgress, "Loading encoder model...");
                    }
                )
            ]);
            
            this.model = decoder;   // The decoder (Hiera Tiny has separate decoder)
            this.encoder = encoder; // The encoder
            
            // Finalize initialization
            this.initialized = true;
            this.isLoading = false;
            this.timing.loadTime = performance.now() - startTime;
            this._setState('loaded');
            this._updateProgress(100, "Models loaded successfully");
            
            this.log(`SAM2 initialized in ${this.timing.loadTime.toFixed(0)}ms`);
            return true;
            
        } catch (error) {
            this.isLoading = false;
            this._setState('error');
            this._triggerEvent('onError', error);
            this.log("Error initializing SAM2:", error);
            throw error;
        }
    }
    
    /**
     * Segment an image with a click point
     * @param {HTMLImageElement|string} image - Image element or data URL
     * @param {Object} point - Click point coordinates {x, y} normalized [0-1]
     * @param {Object} options - Segmentation options
     * @returns {Promise<Object>} Segmentation result
     */
    async segment(image, point, options = {}) {
        if (!this.initialized) {
            await this.initialize();
        }
        
        if (!this.model || !this.encoder) {
            throw new Error("SAM2 models not initialized");
        }
        
        const startTime = performance.now();
        let timingCheckpoint = startTime;
        
        try {
            // Normalize inputs
            const imgElement = await this._normalizeImage(image);
            const normalizedPoint = this._normalizePoint(point);
            
            // Start timeout if configured
            let timeoutId = null;
            const timeoutPromise = new Promise((_, reject) => {
                if (this.config.segmentation?.timeoutMs) {
                    timeoutId = setTimeout(() => {
                        reject(new Error("SAM2 segmentation timed out"));
                    }, this.config.segmentation.timeoutMs);
                }
            });
            
            // Preprocess the image
            const preprocessStart = performance.now();
            const preprocessedImage = await this._preprocessImage(imgElement);
            this.timing.preprocessTime = performance.now() - preprocessStart;
            
            // Perform segmentation based on model architecture
            let result;
            if (this.config.model?.modelArchitecture === 'hiera_tiny') {
                result = await this._segmentWithHieraTiny(preprocessedImage, normalizedPoint, options);
            } else {
                result = await this._segmentWithStandardSAM2(preprocessedImage, normalizedPoint, options);
            }
            
            // Clear timeout if set
            if (timeoutId) clearTimeout(timeoutId);
            
            const totalTime = performance.now() - startTime;
            this.log(`Segmentation completed in ${totalTime.toFixed(0)}ms (` + 
                     `preprocess: ${this.timing.preprocessTime.toFixed(0)}ms, ` +
                     `inference: ${this.timing.inferenceTime.toFixed(0)}ms, ` +
                     `postprocess: ${this.timing.postprocessTime.toFixed(0)}ms)`);
            
            return result;
            
        } catch (error) {
            this.log("Error in SAM2 segmentation:", error);
            this._triggerEvent('onError', error);
            throw error;
        }
    }
    
    /**
     * Segment with Hiera Tiny model architecture
     * @param {Object} preprocessedImage - Preprocessed image
     * @param {Object} normalizedPoint - Normalized point
     * @param {Object} options - Segmentation options
     * @returns {Promise<Object>} Segmentation result
     * @private
     */
    async _segmentWithHieraTiny(preprocessedImage, normalizedPoint, options = {}) {
        this.log("Using Hiera Tiny segmentation workflow");
        
        // Prepare points input
        const pointsInput = this._preparePointsInput([normalizedPoint], preprocessedImage);
        
        // First, run the encoder to get image embeddings
        const encoderInputs = { 
            images: preprocessedImage.tensor
        };
        
        this.log("Running Hiera Tiny encoder inference");
        const encoderStart = performance.now();
        const encoderOutputs = await this.encoder.run(encoderInputs);
        
        // Hiera Tiny models may use different embedding field names
        const imageEmbedding = encoderOutputs.encoder_embedding || 
                              encoderOutputs.image_embeddings || 
                              encoderOutputs.embedding;
        
        if (!imageEmbedding) {
            console.warn("Encoder outputs:", Object.keys(encoderOutputs));
            throw new Error("Image embedding not found in encoder output");
        }
        
        // Then run the decoder (segmentation model)
        const modelInputs = {
            image_embeddings: imageEmbedding,
            point_coords: pointsInput.coords,
            point_labels: pointsInput.labels,
            // Additional input for Hiera Tiny
            orig_im_size: new window.ort.Tensor(
                'float32', 
                new Float32Array([preprocessedImage.height, preprocessedImage.width]), 
                [2]
            )
        };
        
        this.log("Running Hiera Tiny decoder inference");
        const decoderStart = performance.now();
        const outputs = await this.model.run(modelInputs);
        this.timing.inferenceTime = performance.now() - encoderStart;
        
        // Process the output mask
        const postprocessStart = performance.now();
        const result = this._processOutput(outputs, preprocessedImage, normalizedPoint, options);
        this.timing.postprocessTime = performance.now() - postprocessStart;
        
        return result;
    }
    
    /**
     * Segment with standard SAM2 model architecture
     * @param {Object} preprocessedImage - Preprocessed image
     * @param {Object} normalizedPoint - Normalized point
     * @param {Object} options - Segmentation options
     * @returns {Promise<Object>} Segmentation result
     * @private
     */
    async _segmentWithStandardSAM2(preprocessedImage, normalizedPoint, options = {}) {
        // Prepare points input
        const pointsInput = this._preparePointsInput([normalizedPoint], preprocessedImage);
        
        // First, run the encoder to get image embeddings
        const encoderInputs = { images: preprocessedImage.tensor };
        
        this.log("Running encoder inference");
        const encoderStart = performance.now();
        const encoderOutputs = await this.encoder.run(encoderInputs);
        const imageEmbedding = encoderOutputs.image_embeddings;
        
        // Then run the segmentation model
        const modelInputs = {
            image_embeddings: imageEmbedding,
            point_coords: pointsInput.coords,
            point_labels: pointsInput.labels
        };
        
        this.log("Running segmentation model inference");
        const modelStart = performance.now();
        const outputs = await this.model.run(modelInputs);
        this.timing.inferenceTime = performance.now() - encoderStart;
        
        // Process the output mask
        const postprocessStart = performance.now();
        const result = this._processOutput(outputs, preprocessedImage, normalizedPoint, options);
        this.timing.postprocessTime = performance.now() - postprocessStart;
        
        return result;
    }
    
    /**
     * Process segmentation output into a usable format
     * @param {Object} outputs - Model outputs
     * @param {Object} preprocessedImage - Preprocessed image data
     * @param {Object} point - The original click point
     * @param {Object} options - Processing options
     * @returns {Object} Processed result
     * @private
     */
    _processOutput(outputs, preprocessedImage, point, options = {}) {
        // Extract mask data based on model architecture
        let mask;
        
        if (this.config.model?.modelArchitecture === 'hiera_tiny') {
            // Hiera Tiny may have different output format
            mask = outputs.masks || outputs.output || outputs.sam_masks;
            
            if (!mask || !mask.data) {
                // Try to find mask in alternative locations
                for (const key in outputs) {
                    if (outputs[key] && outputs[key].data && 
                        outputs[key].dims && outputs[key].dims.length >= 3) {
                        this.log(`Using alternative mask from ${key}`);
                        mask = outputs[key];
                        break;
                    }
                }
            }
        } else {
            // Standard SAM2 output format
            mask = outputs.masks || outputs.output;
        }
        
        if (!mask || !mask.data) {
            throw new Error("Invalid mask output from model");
        }
        
        // Convert mask data to binary mask using the confidence threshold
        const threshold = options.confidenceThreshold || 
                          this.config.segmentation?.confidenceThreshold || 
                          0.5;
        
        const maskData = mask.data;
        const maskDims = mask.dims;
        const maskHeight = maskDims[maskDims.length - 2]; // Account for different formats
        const maskWidth = maskDims[maskDims.length - 1];
        
        // Create binary mask
        const binaryMask = new Uint8Array(maskHeight * maskWidth);
        for (let i = 0; i < maskHeight * maskWidth; i++) {
            binaryMask[i] = maskData[i] > threshold ? 1 : 0;
        }
        
        // Extract polygon points from mask
        let polygonPoints;
        
        if (options.usePolygon !== false) {
            polygonPoints = this._maskToPolygon(
                binaryMask, 
                maskWidth, 
                maskHeight, 
                options.simplifyTolerance || this.config.segmentation?.simplifyTolerance
            );
        }
        
        // Calculate confidence metrics
        const confidenceMetrics = this._calculateConfidenceMetrics(maskData);
        
        // Return comprehensive result
        return {
            // Processed data
            mask: binaryMask,
            polygon: polygonPoints,
            confidence: confidenceMetrics,
            
            // Metadata
            dimensions: {
                mask: { width: maskWidth, height: maskHeight },
                processed: { width: preprocessedImage.width, height: preprocessedImage.height },
                original: { width: preprocessedImage.originalWidth, height: preprocessedImage.originalHeight }
            },
            
            // Timing data
            timing: { ...this.timing },
            
            // Input data for reference
            input: {
                point: point
            }
        };
    }
    
    /**
     * Convert a mask to polygon points
     * @param {Uint8Array} mask - Binary mask data
     * @param {number} width - Mask width
     * @param {number} height - Mask height
     * @param {number} simplifyTolerance - Tolerance for polygon simplification
     * @returns {Array} Array of polygon points
     * @private
     */
    _maskToPolygon(mask, width, height, simplifyTolerance = 0.0005) {
        // Extract boundary points
        const boundaryPoints = this._extractBoundaryPoints(mask, width, height);
        
        // Apply convex hull if configured
        let hull = boundaryPoints;
        if (this.config.segmentation?.useConvexHull) {
            hull = this._computeConvexHull(boundaryPoints);
        }
        
        // Simplify polygon if configured
        let polygon = hull;
        if (this.config.segmentation?.simplifyPolygon && simplifyTolerance) {
            polygon = this._simplifyPolygon(hull, simplifyTolerance);
        }
        
        // Ensure the polygon is closed
        if (polygon.length > 0) {
            if (polygon[0][0] !== polygon[polygon.length - 1][0] || 
                polygon[0][1] !== polygon[polygon.length - 1][1]) {
                polygon.push([...polygon[0]]);
            }
        }
        
        return polygon;
    }
    
    /**
     * Extract boundary points from a binary mask
     * @param {Uint8Array} mask - Binary mask data
     * @param {number} width - Mask width
     * @param {number} height - Mask height
     * @returns {Array} Array of boundary points
     * @private
     */
    _extractBoundaryPoints(mask, width, height) {
        const boundaryPoints = [];
        const maxPoints = this.config.segmentation?.maxBoundaryPoints || 100;
        const gridSize = Math.ceil(Math.sqrt(maxPoints));
        
        // Sample points on a grid
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const maskX = Math.floor((x / gridSize) * width);
                const maskY = Math.floor((y / gridSize) * height);
                
                // Check if point is in the mask
                const idx = maskY * width + maskX;
                if (maskX >= 0 && maskX < width && maskY >= 0 && maskY < height && mask[idx] === 1) {
                    // Normalize coordinates to [0,1] range
                    const normalizedX = maskX / width;
                    const normalizedY = maskY / height;
                    boundaryPoints.push([normalizedX, normalizedY]);
                }
            }
        }
        
        return boundaryPoints;
    }
    
    /**
     * Compute the convex hull of a set of points
     * @param {Array} points - Array of points [x,y]
     * @returns {Array} Convex hull points
     * @private
     */
    _computeConvexHull(points) {
        if (points.length <= 3) return [...points];
        
        // Sort points by x-coordinate
        points.sort((a, b) => a[0] - b[0]);
        
        // Build lower hull
        const lowerHull = [];
        for (let i = 0; i < points.length; i++) {
            while (lowerHull.length >= 2 && 
                   !this._isCounterClockwise(
                       lowerHull[lowerHull.length - 2], 
                       lowerHull[lowerHull.length - 1], 
                       points[i])) {
                lowerHull.pop();
            }
            lowerHull.push(points[i]);
        }
        
        // Build upper hull
        const upperHull = [];
        for (let i = points.length - 1; i >= 0; i--) {
            while (upperHull.length >= 2 && 
                   !this._isCounterClockwise(
                       upperHull[upperHull.length - 2], 
                       upperHull[upperHull.length - 1], 
                       points[i])) {
                upperHull.pop();
            }
            upperHull.push(points[i]);
        }
        
        // Remove duplicate end points
        upperHull.pop();
        lowerHull.pop();
        
        return [...lowerHull, ...upperHull];
    }
    
    /**
     * Check if three points make a counter-clockwise turn
     * @param {Array} p1 - First point [x,y]
     * @param {Array} p2 - Second point [x,y]
     * @param {Array} p3 - Third point [x,y]
     * @returns {boolean} True if counter-clockwise
     * @private
     */
    _isCounterClockwise(p1, p2, p3) {
        return (p2[0] - p1[0]) * (p3[1] - p2[1]) - (p2[1] - p1[1]) * (p3[0] - p2[0]) > 0;
    }
    
    /**
     * Simplify a polygon using the Douglas-Peucker algorithm
     * @param {Array} points - Array of points [x,y]
     * @param {number} tolerance - Simplification tolerance
     * @returns {Array} Simplified polygon
     * @private
     */
    _simplifyPolygon(points, tolerance) {
        if (points.length <= 2) return points;
        
        // Find the point with the maximum distance
        let maxDistance = 0;
        let index = 0;
        
        const start = points[0];
        const end = points[points.length - 1];
        
        for (let i = 1; i < points.length - 1; i++) {
            const distance = this._perpendicularDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                index = i;
            }
        }
        
        // If max distance is greater than tolerance, recursively simplify
        if (maxDistance > tolerance) {
            // Recursive call
            const firstHalf = this._simplifyPolygon(points.slice(0, index + 1), tolerance);
            const secondHalf = this._simplifyPolygon(points.slice(index), tolerance);
            
            // Join the results
            return [...firstHalf.slice(0, -1), ...secondHalf];
        } else {
            // Base case - use just the endpoints
            return [start, end];
        }
    }
    
    /**
     * Calculate perpendicular distance from a point to a line
     * @param {Array} point - Point [x,y]
     * @param {Array} lineStart - Line start [x,y]
     * @param {Array} lineEnd - Line end [x,y]
     * @returns {number} Perpendicular distance
     * @private
     */
    _perpendicularDistance(point, lineStart, lineEnd) {
        const x = point[0];
        const y = point[1];
        const x1 = lineStart[0];
        const y1 = lineStart[1];
        const x2 = lineEnd[0];
        const y2 = lineEnd[1];
        
        // Line length squared
        const lineLenSq = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
        
        // Handle degenerate case
        if (lineLenSq === 0) return Math.sqrt(Math.pow(x - x1, 2) + Math.pow(y - y1, 2));
        
        // Calculate projection
        const t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lineLenSq;
        
        // Clamp t to line segment
        const clampedT = Math.max(0, Math.min(1, t));
        
        // Calculate closest point on line
        const projX = x1 + clampedT * (x2 - x1);
        const projY = y1 + clampedT * (y2 - y1);
        
        // Calculate distance
        return Math.sqrt(Math.pow(x - projX, 2) + Math.pow(y - projY, 2));
    }
    
    /**
     * Calculate confidence metrics from mask data
     * @param {Float32Array|Uint8Array} maskData - Mask probability data
     * @returns {Object} Confidence metrics
     * @private
     */
    _calculateConfidenceMetrics(maskData) {
        if (!maskData || maskData.length === 0) {
            return { mean: 0, max: 0, min: 0, area: 0 };
        }
        
        let sum = 0;
        let count = 0;
        let min = 1;
        let max = 0;
        
        for (let i = 0; i < maskData.length; i++) {
            const value = maskData[i];
            if (value > 0) {
                sum += value;
                count++;
                min = Math.min(min, value);
                max = Math.max(max, value);
            }
        }
        
        const mean = count > 0 ? sum / count : 0;
        const area = count / maskData.length; // Proportion of positive mask area
        
        return { mean, max, min, area };
    }
    
    /**
     * Preprocess an image for SAM2
     * @param {HTMLImageElement} image - Image element
     * @returns {Promise<Object>} Preprocessed image data
     * @private
     */
    async _preprocessImage(image) {
        const startTime = performance.now();
        
        // Determine target size
        const maxSize = this.config.model?.maxSize || 1024;
        
        // Calculate dimensions while maintaining aspect ratio
        let width, height;
        if (image.width > image.height) {
            width = maxSize;
            height = Math.round((image.height / image.width) * maxSize);
        } else {
            height = maxSize;
            width = Math.round((image.width / image.height) * maxSize);
        }
        
        // Create a canvas for resizing
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0, width, height);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, width, height);
        const pixels = imageData.data;
        
        // Prepare tensor data in the format expected by SAM2: [1, 3, height, width]
        const tensorSize = 3 * height * width;
        const tensorData = new Float32Array(tensorSize);
        
        // Normalize pixel values and arrange in CHW format (channel, height, width)
        let offset = 0;
        
        // Red channel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                tensorData[offset++] = pixels[pixelIndex] / 255.0;
            }
        }
        
        // Green channel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                tensorData[offset++] = pixels[pixelIndex + 1] / 255.0;
            }
        }
        
        // Blue channel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const pixelIndex = (y * width + x) * 4;
                tensorData[offset++] = pixels[pixelIndex + 2] / 255.0;
            }
        }
        
        // Create tensor with shape [1, 3, height, width]
        const tensor = new window.ort.Tensor('float32', tensorData, [1, 3, height, width]);
        
        this.log(`Image preprocessed in ${performance.now() - startTime}ms: ${width}x${height}`);
        
        return { 
            tensor, 
            width, 
            height, 
            originalWidth: image.width, 
            originalHeight: image.height 
        };
    }
    
    /**
     * Prepare points input for the model
     * @param {Array} points - Array of points {x, y}
     * @param {Object} image - Preprocessed image info
     * @returns {Object} Prepared points
     * @private
     */
    _preparePointsInput(points, image) {
        // Ensure points are in pixel coordinates
        const pixelPoints = points.map(point => ({
            x: Math.round(point.x * image.width),
            y: Math.round(point.y * image.height)
        }));
        
        // Each point needs x, y coordinates and a label (1 for foreground, 0 for background)
        const coords = new Float32Array(pixelPoints.length * 2);
        const labels = new Float32Array(pixelPoints.length);
        
        for (let i = 0; i < pixelPoints.length; i++) {
            coords[i * 2] = pixelPoints[i].x;
            coords[i * 2 + 1] = pixelPoints[i].y;
            labels[i] = 1; // 1 for foreground (can be changed for background points)
        }
        
        return {
            coords: new window.ort.Tensor('float32', coords, [1, pixelPoints.length, 2]),
            labels: new window.ort.Tensor('float32', labels, [1, pixelPoints.length])
        };
    }
    
    /**
     * Normalize a click point to [0-1] range
     * @param {Object} point - Point coordinates
     * @returns {Object} Normalized point
     * @private
     */
    _normalizePoint(point) {
        // If point is already normalized (between 0-1), return as is
        if (point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1) {
            return point;
        }
        
        // Otherwise, we assume it's in pixel coordinates and normalize
        // Warning: this makes assumptions about the image dimensions
        console.warn("Point coordinates may not be normalized. Using default dimensions.");
        const defaultWidth = this.config.model?.maxSize || 1024;
        const defaultHeight = this.config.model?.maxSize || 1024;
        
        return {
            x: point.x / defaultWidth,
            y: point.y / defaultHeight
        };
    }
    
    /**
     * Convert an image source to an HTMLImageElement
     * @param {HTMLImageElement|string} src - Image source
     * @returns {Promise<HTMLImageElement>} Image element
     * @private
     */
    async _normalizeImage(src) {
        // If already an HTMLImageElement, return it
        if (src instanceof HTMLImageElement) {
            return src;
        }
        
        // If it's a data URL or URL string, load it
        if (typeof src === 'string') {
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = (err) => reject(new Error(`Failed to load image: ${err}`));
                img.src = src;
            });
        }
        
        // If it's a canvas element
        if (src instanceof HTMLCanvasElement) {
            const dataUrl = src.toDataURL('image/png');
            return this._normalizeImage(dataUrl);
        }
        
        // If it's an ImageData object
        if (src instanceof ImageData) {
            const canvas = document.createElement('canvas');
            canvas.width = src.width;
            canvas.height = src.height;
            const ctx = canvas.getContext('2d');
            ctx.putImageData(src, 0, 0);
            return this._normalizeImage(canvas);
        }
        
        throw new Error("Unsupported image source type");
    }
    

    /**
     * Load an ONNX model with progress tracking
     * @param {string} url - Model URL
     * @param {Object} options - Session options
     * @param {Function} progressCallback - Progress callback
     * @returns {Promise<Object>} ONNX session
     * @private
     */
    async _loadModelWithProgress(url, options, progressCallback) {
        try {
            progressCallback?.(0);
            
            // Fetch the model with progress tracking
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
            }
            
            // Get content length
            const contentLength = response.headers.get('Content-Length');
            const total = contentLength ? parseInt(contentLength, 10) : 0;
            
            // Read the response as a stream
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
                
                // Report progress if total is known
                if (total && progressCallback) {
                    const progress = Math.min(0.99, receivedLength / total);
                    progressCallback(progress);
                }
            }
            
            // 99% - model downloaded, now initializing
            progressCallback?.(0.99);
            
            // Concatenate chunks
            const modelData = new Uint8Array(receivedLength);
            let position = 0;
            for (const chunk of chunks) {
                modelData.set(chunk, position);
                position += chunk.length;
            }
            
            // Create ONNX session
            this.log(`Creating ONNX session for ${url}`);
            const session = await window.ort.InferenceSession.create(modelData.buffer, options);
            
            // 100% - model loaded and ready
            progressCallback?.(1.0);
            
            return session;
            
        } catch (error) {
            this.log(`Error loading model ${url}:`, error);
            throw error;
        }
    }

    /**
     * Register an event handler
     * @param {string} event - Event name
     * @param {Function} handler - Event handler
     * @returns {Function} Unregister function
     */
    on(event, handler) {
        if (!this.eventHandlers[event]) {
            this.eventHandlers[event] = [];
        }
        
        this.eventHandlers[event].push(handler);
        
        // Return unregister function
        return () => {
            this.eventHandlers[event] = this.eventHandlers[event].filter(h => h !== handler);
        };
    }

    /**
     * Trigger an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @private
     */
    _triggerEvent(event, data) {
        if (!this.eventHandlers[event]) return;
        
        for (const handler of this.eventHandlers[event]) {
            try {
                handler(data);
            } catch (error) {
                console.error(`Error in ${event} handler:`, error);
            }
        }
    }

    /**
     * Update loading progress
     * @param {number} progress - Progress percentage (0-100)
     * @param {string} message - Progress message
     * @private
     */
    _updateProgress(progress, message) {
        this.progress = progress;
        this._triggerEvent('onProgress', { progress, message });
        
        // Update progress bar in UI if available
        const progressBar = document.getElementById('sam2-loading-progress');
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
            progressBar.style.display = 'block';
            
            // Hide when complete
            if (progress >= 100) {
                setTimeout(() => {
                    progressBar.style.width = '0%';
                    progressBar.style.display = 'none';
                }, 1000);
            }
        }
    }

    /**
     * Update model state
     * @param {string} state - New state
     * @private
     */
    _setState(state) {
        this.modelState = state;
        this._triggerEvent('onStateChange', { state });
        
        // Update status indicator in UI if available
        const statusIndicator = document.querySelector('.sam2-status-indicator');
        const statusText = document.querySelector('.sam2-status-text');
        
        if (statusIndicator) {
            statusIndicator.className = 'sam2-status-indicator sam2-status-' + state;
        }
        
        if (statusText) {
            switch (state) {
                case 'loading':
                    statusText.textContent = 'SAM2 Modell wird geladen...';
                    break;
                case 'loaded':
                    statusText.textContent = 'SAM2 Modell bereit';
                    break;
                case 'error':
                    statusText.textContent = 'Fehler beim Laden des SAM2 Modells';
                    break;
                default:
                    statusText.textContent = 'SAM2 Modell nicht geladen';
            }
        }
    }

    /**
     * Log a message if debug is enabled
     * @param {...*} args - Log arguments
     */
    log(...args) {
        if (this.debug) {
            console.log('[SAM2]', ...args);
        }
    }

    /**
     * Ensure ONNX Runtime is available
     * @returns {Promise<void>}
     * @private
     */
    async _ensureONNXRuntime() {
        if (typeof window.ort !== 'undefined') {
            this.log("ONNX Runtime already loaded", window.ort.version);
            return;
        }
        
        this.log("Loading ONNX Runtime");
        
        // Check alternative locations
        if (typeof window.onnxruntime !== 'undefined') {
            window.ort = window.onnxruntime;
            return;
        }
        
        if (typeof window.ONNXRuntime !== 'undefined') {
            window.ort = window.ONNXRuntime;
            return;
        }
        
        // Try to load dynamically
        try {
            this._updateProgress(2, "Loading ONNX Runtime...");
            
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js';
            script.crossOrigin = 'anonymous';
            
            // Warten, bis das Skript geladen ist
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error("Failed to load ONNX Runtime"));
                document.head.appendChild(script);
            });
            
            // Zusätzliche Wartezeit für die Initialisierung
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (typeof window.ort === 'undefined') {
                if (typeof window.onnxruntime !== 'undefined') {
                    window.ort = window.onnxruntime;
                } else if (typeof window.ONNXRuntime !== 'undefined') {
                    window.ort = window.ONNXRuntime;
                } else {
                    throw new Error("ONNX Runtime failed to initialize after loading");
                }
            }
            
            this.log("ONNX Runtime loaded", window.ort.version);
            
        } catch (error) {
            this.log("Error loading ONNX Runtime:", error);
            throw new Error("Failed to load ONNX Runtime: " + error.message);
        }
    }
}
    
// Create and export a global instance
window.sam2 = new SAM2API(window.SAM2_CONFIG);

// Export the class for direct use
window.SAM2API = SAM2API;