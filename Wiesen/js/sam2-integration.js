/**
 * SAM2 Integration for map segmentation
 * This file integrates the SAM2 model from Labelbox with the existing map application
 * 
 * Implementation uses the SAM2API class defined in sam2-api.js
 */

// Reference to the global SAM2 instance
const sam2 = window.sam2;

// Track segmentation state
let sam2SegmentationInProgress = false;
let sam2SegmentationMode = false;
let sam2SegmentationMarker = null;

/**
 * Initialize SAM2 models
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initSAM2() {
    try {
        // Check if already initialized
        if (sam2.initialized) {
            console.log("SAM2 already initialized");
            return true;
        }
        
        // Check if loading
        if (sam2.isLoading) {
            console.log("SAM2 is already loading");
            return false;
        }
        
        // Show loading UI
        showSegmentationLoading(true, "Initialisiere SAM2 Modelle...");
        
        // Register progress callback
        sam2.on('onProgress', ({ progress, message }) => {
            showSegmentationLoading(true, message || `Lade SAM2 Modelle (${Math.round(progress)}%)...`);
            
            // Update progress bar
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
        });
        
        // Register error callback
        sam2.on('onError', (error) => {
            console.error("SAM2 error:", error);
            showSegmentationLoading(true, `Fehler: ${error.message}`);
            setTimeout(() => showSegmentationLoading(false), 3000);
        });
        
        // Initialize SAM2
        await sam2.initialize();
        
        // Update UI when complete
        showSegmentationLoading(true, "SAM2 Modelle erfolgreich geladen!");
        setTimeout(() => showSegmentationLoading(false), 1000);
        
        // Update settings UI
        updateSAM2SettingsUI(true);
        
        return true;
        
    } catch (error) {
        console.error("Error initializing SAM2:", error);
        showSegmentationLoading(true, `Fehler beim Laden von SAM2: ${error.message}`);
        setTimeout(() => showSegmentationLoading(false), 3000);
        
        // Update settings UI
        updateSAM2SettingsUI(false);
        
        return false;
    }
}

/**
 * Update the SAM2 settings UI
 * @param {boolean} success - Whether initialization was successful
 */
function updateSAM2SettingsUI(success) {
    // Show SAM2 controls
    const sam2Controls = document.getElementById('sam2-controls');
    if (sam2Controls) {
        sam2Controls.style.display = 'block';
    }
    
    // Update status indicator
    const statusIndicator = document.querySelector('.sam2-status-indicator');
    const statusText = document.querySelector('.sam2-status-text');
    
    if (statusIndicator && statusText) {
        if (success) {
            statusIndicator.className = 'sam2-status-indicator sam2-status-loaded';
            statusText.textContent = 'SAM2 Modell bereit';
        } else {
            statusIndicator.className = 'sam2-status-indicator sam2-status-error';
            statusText.textContent = 'Fehler beim Laden des SAM2 Modells';
        }
    }
}

/**
 * Run SAM2 segmentation on the current map view with a click point
 * @param {number} lat - Latitude of clicked point
 * @param {number} lng - Longitude of clicked point
 * @param {Object} mapBounds - Map bounds
 * @returns {Promise<Array>} - Array of polygon points
 */
async function runSAM2Segmentation(lat, lng, mapBounds) {
    try {
        // Make sure models are loaded
        if (!sam2.initialized) {
            const initialized = await initSAM2();
            if (!initialized) {
                throw new Error("SAM2 Modelle konnten nicht initialisiert werden");
            }
        }
        
        // Capture the current map view as an image
        showSegmentationLoading(true, "Erfasse Kartenansicht...");
        const imageData = await captureMapView();
        if (!imageData) {
            throw new Error("Kartenansicht konnte nicht erfasst werden");
        }
        
        // Get segmentation threshold from UI slider if available
        let confidenceThreshold = 0.5; // Default value
        const thresholdSlider = document.getElementById('sam2-threshold');
        if (thresholdSlider) {
            // Convert 0-100 range to 0.1-0.9 range (inverted, as higher values mean less strict segmentation)
            confidenceThreshold = 0.9 - (thresholdSlider.value / 100) * 0.8;
        }
        
        // Prepare normalized point coordinates (0-1 range)
        const nw = mapBounds.getNorthWest();
        const se = mapBounds.getSouthEast();
        
        // Normalize the click point to [0,1] range based on map bounds
        const normalizedPoint = {
            x: (lng - nw.lng) / (se.lng - nw.lng),
            y: (lat - nw.lat) / (se.lat - nw.lat)
        };
        
        // Run SAM2 segmentation
        showSegmentationLoading(true, "Führe SAM2 Segmentierung durch...");
        
        // Configure segmentation options
        const segmentOptions = {
            confidenceThreshold: confidenceThreshold,
            simplifyTolerance: 0.00005,
            useConvexHull: true
        };
        
        // Perform segmentation
        const result = await sam2.segment(imageData, normalizedPoint, segmentOptions);
        
        // Log performance metrics if in debug mode
        if (window.SAM2_CONFIG?.debug?.logPerformance) {
            console.log("SAM2 Segmentierung Performance:", {
                total: result.timing.preprocessTime + result.timing.inferenceTime + result.timing.postprocessTime + "ms",
                preprocess: result.timing.preprocessTime + "ms",
                inference: result.timing.inferenceTime + "ms",
                postprocess: result.timing.postprocessTime + "ms"
            });
        }
        
        // Convert normalized polygon points to map coordinates
        const mapPolygonPoints = normalizedPolygonToMapCoordinates(
            result.polygon, 
            mapBounds
        );
        
        showSegmentationLoading(false);
        return mapPolygonPoints;
        
    } catch (error) {
        console.error("Fehler bei der SAM2 Segmentierung:", error);
        showSegmentationLoading(false);
        
        // Fall back to simulated polygon if configured
        if (window.SAM2_CONFIG?.segmentation?.fallbackToSimulation) {
            console.warn("Verwende simuliertes Polygon als Fallback");
            return generateSimulatedPolygon(lat, lng);
        }
        
        throw error;
    }
}

/**
 * Convert normalized polygon points to map coordinates
 * @param {Array} polygon - Polygon points in normalized coordinates [0-1]
 * @param {Object} bounds - Map bounds
 * @returns {Array} - Polygon points in map coordinates [lat, lng]
 */
function normalizedPolygonToMapCoordinates(polygon, bounds) {
    if (!polygon || polygon.length === 0) {
        console.warn("Leeres Polygon");
        return [];
    }
    
    const nw = bounds.getNorthWest();
    const se = bounds.getSouthEast();
    const lngRange = se.lng - nw.lng;
    const latRange = se.lat - nw.lat;
    
    // Convert normalized points to map coordinates
    return polygon.map(point => {
        const lng = nw.lng + point[0] * lngRange;
        const lat = nw.lat + point[1] * latRange;
        return [lat, lng];
    });
}

/**
 * Capture the current map view
 * @returns {Promise<string>} - Data URL of the captured image
 */
async function captureMapView() {
    return new Promise((resolve, reject) => {
        try {
            // Option 1: Use html2canvas, if available (preferred method)
            if (window.html2canvas) {
                const mapElement = document.getElementById('map');
                
                // Get the map dimensions
                const mapRect = mapElement.getBoundingClientRect();
                const mapWidth = mapRect.width;
                const mapHeight = mapRect.height;
                
                // Set maximum size to avoid performance issues
                const maxSize = 1024;
                let scale = 1;
                
                if (mapWidth > maxSize || mapHeight > maxSize) {
                    scale = Math.min(maxSize / mapWidth, maxSize / mapHeight);
                }
                
                // Configure html2canvas with optimized settings
                const options = {
                    scale: scale,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: null,
                    logging: false,
                    imageTimeout: 0
                };
                
                html2canvas(mapElement, options).then(canvas => {
                    resolve(canvas.toDataURL('image/jpeg', 0.85));
                }).catch(error => {
                    console.warn("html2canvas Fehler:", error);
                    // Try alternate method
                    captureMapViewAlternative().then(resolve).catch(reject);
                });
                return;
            }
            
            // If html2canvas is not available, try alternate method
            captureMapViewAlternative().then(resolve).catch(reject);
            
        } catch (error) {
            console.error("Fehler beim Erfassen der Kartenansicht:", error);
            resolve(null); // Don't propagate error to allow fallback
        }
    });
}

/**
 * Alternative method to capture map view
 * @returns {Promise<string|null>} - Data URL of the map capture or null
 */
async function captureMapViewAlternative() {
    try {
        // Option 2: Try to take a screenshot using the Screenshot API (requires permissions)
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
            const stream = await navigator.mediaDevices.getDisplayMedia({video: true});
            const track = stream.getVideoTracks()[0];
            const imageCapture = new ImageCapture(track);
            const bitmap = await imageCapture.grabFrame();
            
            // Stop the stream
            track.stop();
            
            // Draw the bitmap to a canvas
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            
            return canvas.toDataURL('image/jpeg', 0.85);
        }
        
        // Option 3: Create a canvas from the map element directly (limited support)
        const mapElement = document.getElementById('map');
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        canvas.width = mapElement.offsetWidth;
        canvas.height = mapElement.offsetHeight;
        
        // Try to render the map element to the canvas (works in some browsers)
        const svgData = new XMLSerializer().serializeToString(mapElement);
        const img = new Image();
        
        return new Promise((resolve) => {
            img.onload = function() {
                context.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            
            img.onerror = function() {
                console.warn("Fehler beim Erstellen des Bildes aus SVG");
                resolve(null);
            };
            
            img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
        });
        
    } catch (error) {
        console.error("Fehler bei der alternativen Kartenerfassung:", error);
        return null;
    }
}

/**
 * SAM2 segmentation handler for map click events
 * @param {Object} e - Map click event
 */
async function triggerSAM2Segmentation(e) {
    if (sam2SegmentationInProgress) {
        showNotification('Eine Segmentierung läuft bereits. Bitte warten Sie.', 3000);
        return;
    }
    
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    
    // Set marker to indicate click point
    if (sam2SegmentationMarker) {
        map.removeLayer(sam2SegmentationMarker);
    }
    
    sam2SegmentationMarker = L.marker([lat, lng], {
        icon: L.divIcon({
            className: 'segmentation-marker',
            html: '<div class="pulsating-circle"></div>',
            iconSize: [20, 20]
        })
    }).addTo(map);
    
    // Update status
    sam2SegmentationInProgress = true;
    showSegmentationLoading(true, "Initialisiere SAM2...");
    
    try {
        // Get map bounds
        const bounds = map.getBounds();
        
        // Show pulsating marker animation
        const markerElement = sam2SegmentationMarker.getElement();
        if (markerElement) {
            markerElement.classList.add('active');
        }
        
        // Start time measurement if debug is enabled
        const startTime = performance.now();
        
        // Run SAM2 segmentation
        const polygonPoints = await runSAM2Segmentation(lat, lng, bounds);
        
        // Log performance if debug is enabled
        if (window.SAM2_CONFIG?.debug?.logPerformance) {
            const totalTime = performance.now() - startTime;
            console.log(`Gesamtzeit für Segmentierung: ${totalTime.toFixed(0)}ms`);
        }
        
        // Create segmented polygon
        createSegmentedPolygon(polygonPoints);
        
        // Show success message
        showNotification('SAM2 hat die Fläche erfolgreich erkannt!', 3000);
        
    } catch (error) {
        console.error("SAM2 Segmentierungsfehler:", error);
        
        // Show error notification instead of alert
        showNotification(`Segmentierungsfehler: ${error.message}`, 5000, 'error');
        
        // Try fallback to original SAM if configured
        if (window.SAM2_CONFIG?.model?.fallbackToSAM && typeof performSegmentation === 'function') {
            showNotification('Versuche Fallback zur ursprünglichen Segmentierung...', 3000);
            try {
                const result = await performSegmentation(lat, lng);
                createSegmentedPolygon(result);
                showNotification('Fallback-Segmentierung erfolgreich', 3000);
            } catch (fallbackError) {
                console.error("Fallback-Segmentierungsfehler:", fallbackError);
                showNotification('Fallback-Segmentierung fehlgeschlagen', 3000, 'error');
            }
        }
    } finally {
        // Reset status
        showSegmentationLoading(false);
        sam2SegmentationInProgress = false;
        
        // Remove marker
        if (sam2SegmentationMarker) {
            map.removeLayer(sam2SegmentationMarker);
            sam2SegmentationMarker = null;
        }
        
        // End segmentation mode
        stopSAM2SegmentAnything();
    }
}

/**
 * Start SAM2 segmentation mode
 */
function startSAM2SegmentAnything() {
    if (sam2SegmentationMode) {
        stopSAM2SegmentAnything();
        return;
    }
    
    // Initialize SAM2 upfront
    initSAM2().then(success => {
        if (success) {
            sam2SegmentationMode = true;
            
            // Update button appearance
            const segmentButton = document.getElementById('start-segment');
            if (segmentButton) {
                // Use configuration for button text if available
                const buttonText = window.SAM2_CONFIG?.ui?.activeButtonText || 'SAM2 Segmentierung abbrechen';
                const buttonColor = window.SAM2_CONFIG?.ui?.activeButtonColor || '#f44336';
                
                segmentButton.innerHTML = `<i class="fas fa-times"></i> ${buttonText}`;
                segmentButton.style.backgroundColor = buttonColor;
                segmentButton.classList.add('sam2-active');
            }
            
            // Enable Bayern Atlas overlay for better visual reference
            bayerAtlasOverlay.addTo(map);
            const bayernAtlasCheckbox = document.querySelector('input[type="checkbox"][name="' + L.Util.stamp(bayerAtlasOverlay) + '"]');
            if (bayernAtlasCheckbox) {
                bayernAtlasCheckbox.checked = true;
            }
            
            // Add click event handler
            map.on('click', triggerSAM2Segmentation);
            
            // Change cursor
            setSegmentationCursor(true);
            
            // Show user instructions with a notification instead of alert
            showNotification('Klicken Sie auf eine Fläche, die Sie segmentieren möchten. SAM2 wird versuchen, die Grenzen automatisch zu erkennen.', 5000);
        } else {
            // If SAM2 initialization failed, try original SAM as fallback
            if (window.SAM2_CONFIG?.model?.fallbackToSAM && typeof startSegmentAnything === 'function' && 
                window.originalStartSegmentAnything) {
                
                showNotification('SAM2 konnte nicht initialisiert werden. Verwende Original-SAM...', 3000);
                window.originalStartSegmentAnything();
            } else {
                showNotification('Fehler beim Initialisieren von SAM2. Bitte versuchen Sie es erneut oder prüfen Sie die Konsole.', 5000, 'error');
            }
        }
    });
}

/**
 * Stop SAM2 segmentation mode
 */
function stopSAM2SegmentAnything() {
    if (!sam2SegmentationMode) return;
    
    sam2SegmentationMode = false;
    
    // Reset button
    const segmentButton = document.getElementById('start-segment');
    if (segmentButton) {
        // Use configuration for button text if available
        const buttonText = window.SAM2_CONFIG?.ui?.buttonText || 'SAM2 Segmentierung';
        const buttonColor = window.SAM2_CONFIG?.ui?.buttonColor || '#3F51B5';
        
        segmentButton.innerHTML = `<i class="fas fa-magic"></i> ${buttonText}`;
        segmentButton.style.backgroundColor = buttonColor;
        segmentButton.classList.remove('sam2-active');
        
        // Re-add badge if configured
        if (window.SAM2_CONFIG?.ui?.showBadge !== false) {
            const badgeText = window.SAM2_CONFIG?.ui?.badgeText || 'SAM2';
            
            // Remove existing badge if any
            const existingBadge = segmentButton.querySelector('.sam2-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            const badge = document.createElement('span');
            badge.className = 'sam2-badge';
            badge.textContent = badgeText;
            segmentButton.appendChild(badge);
        }
    }
    
    // Remove map click handler
    map.off('click', triggerSAM2Segmentation);
    
    // Reset cursor
    setSegmentationCursor(false);
    
    // Remove marker if exists
    if (sam2SegmentationMarker) {
        map.removeLayer(sam2SegmentationMarker);
        sam2SegmentationMarker = null;
    }
}

/**
 * Set cursor style for segmentation mode
 * @param {boolean} enable - Whether to enable segmentation cursor
 */
function setSegmentationCursor(enable) {
    const mapContainer = document.getElementById('map');
    if (!mapContainer) return;
    
    if (enable) {
        mapContainer.style.cursor = 'crosshair';
    } else {
        mapContainer.style.cursor = '';
    }
}

/**
 * Show a notification to the user
 * @param {string} message - Message to display
 * @param {number} duration - Duration in milliseconds (0 for persistent)
 * @param {string} type - Notification type (info, success, error)
 */
function showNotification(message, duration = 5000, type = 'info') {
    // Remove existing notification
    const existingNotification = document.getElementById('sam2-notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.id = 'sam2-notification';
    notification.className = 'notification sam2';
    
    // Apply type-specific class
    if (type === 'success') {
        notification.className += ' sam2-success';
    } else if (type === 'error') {
        notification.className += ' sam2-error';
    }
    
    // Set content
    notification.innerHTML = `
        <div class="notification-content">
            <p>${message}</p>
            <button class="notification-close"><i class="fas fa-times"></i></button>
        </div>
    `;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Set up close button
    const closeButton = notification.querySelector('.notification-close');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            notification.classList.add('notification-hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
    }
    
    // Auto hide after duration (if not permanent)
    if (duration > 0) {
        setTimeout(() => {
            notification.classList.add('notification-hide');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, duration);
    }
}

/**
 * Show segmentation loading indicator
 * @param {boolean} show - Whether to show or hide the indicator
 * @param {string} message - Message to display
 */
function showSegmentationLoading(show, message = "Segmentierung läuft...") {
    let loadingEl = document.getElementById('segmentation-loading');
    
    if (show) {
        if (!loadingEl) {
            loadingEl = document.createElement('div');
            loadingEl.id = 'segmentation-loading';
            loadingEl.className = 'segmentation-loading';
            loadingEl.innerHTML = `
                <div class="loading-content sam2">
                    <div class="spinner sam2"></div>
                    <p id="loading-message">${message}</p>
                </div>
            `;
            document.body.appendChild(loadingEl);
        } else {
            // Update message if loading indicator already exists
            const messageEl = loadingEl.querySelector('#loading-message');
            if (messageEl) {
                messageEl.textContent = message;
            }
        }
        loadingEl.style.display = 'flex';
    } else if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

/**
 * Create a segmented polygon from points
 * @param {Array} points - Array of polygon points [lat, lng]
 */
function createSegmentedPolygon(points) {
    // Ensure we have enough points
    if (!points || points.length < 3) {
        console.warn("Nicht genügend Punkte für ein Polygon");
        showNotification("Nicht genügend Punkte für ein Polygon erkannt", 3000, 'error');
        return;
    }
    
    // Clear existing polygon points
    clearPolygonPoints();
    
    // Add each point to the polygon
    for (let i = 0; i < points.length - 1; i++) {  // Skip last point if it's a duplicate of first
        addPolygonPointAtCoords(points[i]);
    }
    
    // Create the final polygon
    finishPolygon();
    
    // Zoom to the polygon
    if (polygonLayer) {
        map.fitBounds(polygonLayer.getBounds(), {
            padding: [50, 50],  // Add padding for better visibility
            maxZoom: 19         // Limit max zoom level
        });
    }
    
    // Show success notification
    showNotification('Fläche erfolgreich erkannt! Sie können die Punkte nun bearbeiten oder das Polygon exportieren.', 5000, 'success');
}

/**
 * Generate a simulated polygon around a point (fallback)
 * @param {number} centerLat - Center latitude
 * @param {number} centerLng - Center longitude
 * @returns {Array} - Array of polygon points [lat, lng]
 */
function generateSimulatedPolygon(centerLat, centerLng) {
    // Create an irregular polygon around the center point
    const points = [];
    const numPoints = 8 + Math.floor(Math.random() * 6); // 8-13 points
    const baseRadius = 0.001 + Math.random() * 0.002; // Random radius (approx. 100-300m)
    
    for (let i = 0; i < numPoints; i++) {
        const angle = (i / numPoints) * 2 * Math.PI;
        // Make it irregular by varying the radius
        const radius = baseRadius * (0.8 + Math.random() * 0.4); 
        const lat = centerLat + radius * Math.sin(angle);
        const lng = centerLng + radius * Math.cos(angle);
        points.push([lat, lng]);
    }
    
    // Close the polygon
    points.push([...points[0]]);
    
    return points;
}

/**
 * Replace or extend the existing segmentation function with SAM2
 */
function enhanceSegmentAnythingWithSAM2() {
    // Backup the original function if it exists
    if (typeof window.startSegmentAnything === 'function') {
        window.originalStartSegmentAnything = window.startSegmentAnything;
    } else if (typeof startSegmentAnything === 'function') {
        window.originalStartSegmentAnything = startSegmentAnything;
    }
    
    // Replace with SAM2 version
    window.startSegmentAnything = startSAM2SegmentAnything;
    
    // Update UI to indicate SAM2 availability
    updateSegmentAnythingUI();
    
    // Initialize SAM2 controls
    initSAM2Controls();
}

/**
 * Update the UI to indicate SAM2 availability
 */
function updateSegmentAnythingUI() {
    const segmentBtn = document.getElementById('start-segment');
    if (segmentBtn) {
        // Use configuration for button text if available
        const buttonText = window.SAM2_CONFIG?.ui?.buttonText || 'SAM2 Segmentierung';
        const buttonColor = window.SAM2_CONFIG?.ui?.buttonColor || '#3F51B5';
        
        segmentBtn.innerHTML = `<i class="fas fa-magic"></i> ${buttonText}`;
        segmentBtn.title = 'Segmentieren Sie Flächen mit SAM2 - einem leistungsfähigeren KI-Modell';
        segmentBtn.style.backgroundColor = buttonColor;
        segmentBtn.classList.add('sam2-mode');
        
        // Add a small badge to indicate SAM2 if configured
        if (window.SAM2_CONFIG?.ui?.showBadge !== false) {
            const badgeText = window.SAM2_CONFIG?.ui?.badgeText || 'SAM2';
            
            const badge = document.createElement('span');
            badge.className = 'sam2-badge';
            badge.textContent = badgeText;
            
            // Remove existing badge if any
            const existingBadge = segmentBtn.querySelector('.sam2-badge');
            if (existingBadge) {
                existingBadge.remove();
            }
            
            segmentBtn.appendChild(badge);
        }
    }
}

/**
 * Initialize SAM2 controls and settings UI
 */
function initSAM2Controls() {
    // Get the controls container
    const controlsContainer = document.getElementById('sam2-controls');
    if (!controlsContainer) {
        console.warn("SAM2 Steuerelemente-Container nicht gefunden");
        return;
    }
    
    // Show controls if configured
    if (window.SAM2_CONFIG?.ui?.showControls !== false) {
        controlsContainer.style.display = 'block';
    }
    
    // Set up threshold slider events
    const thresholdSlider = document.getElementById('sam2-threshold');
    if (thresholdSlider) {
        // Set initial value from config if available
        if (window.SAM2_CONFIG?.segmentation?.confidenceThreshold) {
            // Convert 0.1-0.9 range to 0-100 range (inverted)
            const thresholdValue = Math.round((0.9 - window.SAM2_CONFIG.segmentation.confidenceThreshold) / 0.8 * 100);
            thresholdSlider.value = thresholdValue;
        }
        
        // Add event listener for real-time updates
        thresholdSlider.addEventListener('input', function() {
            // Value will be read when needed
        });
    }
    
    // Initialize the status indicator
    updateSAM2SettingsUI(false);
}

// Initialize SAM2 integration when the document is ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("Initialisiere SAM2 Integration");
    
    // Replace or extend the existing segmentation function
    setTimeout(() => {
        enhanceSegmentAnythingWithSAM2();
    }, 500);
    
    // Preload SAM2 models if configured
    if (window.SAM2_CONFIG?.model?.preload) {
        setTimeout(() => {
            console.log("Lade SAM2 Modelle im Hintergrund");
            showNotification("SAM2 Modelle werden im Hintergrund geladen...", 3000);
            
            initSAM2().then(success => {
                if (success) {
                    console.log("SAM2 Modelle erfolgreich vorgeladen");
                    showNotification("SAM2 Modelle erfolgreich geladen!", 3000, 'success');
                } else {
                    console.warn("Fehler beim Vorladen der SAM2 Modelle");
                }
            });
        }, 3000); // Wait 3 seconds after page load before preloading
    }
});