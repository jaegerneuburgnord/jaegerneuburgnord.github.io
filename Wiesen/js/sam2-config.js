/**
 * Configuration file for SAM2 integration
 * This file contains settings that control the behavior of the SAM2 model
 */

const SAM2_CONFIG = {
    // Model settings
    model: {
        // URLs for the model files
        // These point to the latest versions from Roboflow's CDN
        modelUrl: 'https://cdn.jsdelivr.net/npm/@roboflow/sam2-web@latest/weights/segment-anything-2_quant.onnx',
        encoderUrl: 'https://cdn.jsdelivr.net/npm/@roboflow/sam2-web@latest/weights/encoder_quant.onnx',
        
        // Whether to use cache for models
        useCache: true,
        
        // Maximum dimensions for image processing
        // Higher values = more accurate but slower
        maxSize: 1024,
        
        // Whether to preload models on page load
        preload: false,
        
        // Backend to use for ONNX inference
        // 'webgl' is faster but may not work on all devices
        // 'wasm' is more compatible but slower
        backend: 'webgl',
        
        // Fallback to original SAM if SAM2 fails
        fallbackToSAM: true
    },
    
    // Segmentation settings
    segmentation: {
        // Confidence threshold for the mask (0-1)
        confidenceThreshold: 0.5,
        
        // Maximum number of points to use for boundary extraction
        maxBoundaryPoints: 100,
        
        // Use convex hull for polygon creation
        useConvexHull: true,
        
        // Use Douglas-Peucker algorithm for polygon simplification
        simplifyPolygon: true,
        
        // Tolerance for polygon simplification (in degrees)
        simplifyTolerance: 0.00005,
        
        // Maximum time allowed for segmentation (ms)
        // If exceeded, will use fallback method
        timeoutMs: 10000
    },
    
    // UI settings
    ui: {
        // Show additional controls for SAM2
        showControls: true,
        
        // Show performance metrics
        showMetrics: true,
        
        // Default button text
        buttonText: 'SAM2 Segmentation',
        
        // Button text when active
        activeButtonText: 'Cancel SAM2',
        
        // Custom styles
        buttonColor: '#3F51B5',
        activeButtonColor: '#f44336',
        
        // Show badge on button
        showBadge: true,
        
        // Badge text
        badgeText: 'SAM2'
    },
    
    // Debug settings
    debug: {
        // Enable debug logging
        enabled: false,
        
        // Log performance metrics
        logPerformance: true,
        
        // Show visualization of model inputs/outputs
        showVisualizations: false
    }
};

// Don't modify below this line
// Export the configuration for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SAM2_CONFIG;
} else {
    window.SAM2_CONFIG = SAM2_CONFIG;
}