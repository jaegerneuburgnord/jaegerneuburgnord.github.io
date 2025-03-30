/**
 * Configuration file for SAM2 integration
 * This file contains settings that control the behavior of the SAM2 model
 */

const SAM2_CONFIG = {
    // Model settings
    model: {
        // URLs for the model files - using the Hiera Tiny models from mobilesam directory
        modelUrl: './models/mobilesam/sam2_hiera_tiny.decoder.onnx',
        encoderUrl: './models/mobilesam/sam2_hiera_tiny.encoder.onnx',
        
        // Whether to use cache for models
        useCache: true,
        
        // Maximum dimensions for image processing
        // Lower for Hiera Tiny model for better performance
        maxSize: 768,
        
        // Whether to preload models on page load
        preload: false,
        
        // Backend to use for ONNX inference
        // 'webgl' is faster but may not work on all devices
        // 'wasm' is more compatible but slower
        backend: 'webgl',
        
        // Fallback to original SAM if SAM2 fails
        fallbackToSAM: true,
        
        // Hiera Tiny specific settings
        modelArchitecture: 'hiera_tiny',
        inputShape: [1, 3, 768, 768]
    },
    
    // Segmentation settings
    segmentation: {
        // Confidence threshold for the mask (0-1)
        // Hiera Tiny might need a lower threshold
        confidenceThreshold: 0.35,
        
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
        timeoutMs: 10000,
        
        // Fall back to simulated polygon if all else fails
        fallbackToSimulation: true
    },
    
    // UI settings
    ui: {
        // Show additional controls for SAM2
        showControls: true,
        
        // Show performance metrics
        showMetrics: true,
        
        // Default button text
        buttonText: 'SAM2 Tiny Segmentierung',
        
        // Button text when active
        activeButtonText: 'Abbrechen',
        
        // Custom styles
        buttonColor: '#3F51B5',
        activeButtonColor: '#f44336',
        
        // Show badge on button
        showBadge: true,
        
        // Badge text
        badgeText: 'SAM2 Tiny'
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