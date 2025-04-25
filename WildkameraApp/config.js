/**
 * config.js
 * Enthält Konfigurationen und Befehlsdefinitionen für die Wildkamera-App
 */

// ------ App-Konfiguration ------

/**
 * Globale Konfiguration für die Wildkamera-App
 */
const APP_CONFIG = {
    // App-Einstellungen
    app: {
        name: "Wildkamera SMS-Steuerung",
        version: "1.2.0",
        defaultLanguage: "de",
        debug: false,
        // Offline-Modus-Einstellungen
        offline: {
            cacheSize: 50,  // Maximale Anzahl an gespeicherten SMS
            retryInterval: 30, // Sekunden zwischen Synchronisationsversuchen
            maxRetries: 5,  // Maximale Anzahl von Wiederholungsversuchen
        }
    },
    
    // Kameratypen und ihre Funktionen
    cameraTypes: {
        Standard: {
            features: {
                maxPhotoResolution: "12MP",
                maxVideoResolution: "HD-1280x720",
                mmsControl: false,
                timelapse: false,
                ftpSupport: true,
                multipleTimers: false,
                pirLevels: 3, // Niedrig, Mittel, Hoch
                nightModes: ["Balance", "Öko"]
            },
            defaultSettings: {
                captureMode: "Bild",
                pirSensitivity: "L7",
                videoLength: "5s"
            }
        },
        Pro: {
            features: {
                maxPhotoResolution: "24M",
                maxVideoResolution: "FHD-1920x1080",
                mmsControl: true,
                timelapse: true,
                ftpSupport: true,
                multipleTimers: true,
                pirLevels: 9, // L1-L9
                nightModes: ["Balance", "Qualität", "Öko"]
            },
            defaultSettings: {
                captureMode: "Bild+Video",
                pirSensitivity: "L5",
                videoLength: "10s"
            }
        },
        Max: {
            features: {
                maxPhotoResolution: "32M",
                maxVideoResolution: "FHD-1920x1080",
                mmsControl: true,
                timelapse: true,
                ftpSupport: true,
                multipleTimers: true,
                pirLevels: 9, // L1-L9
                nightModes: ["Balance", "Qualität", "Öko"]
            },
            defaultSettings: {
                captureMode: "Bild+Video",
                pirSensitivity: "L7",
                videoLength: "15s"
            }
        }
    },
    
    // SMS-Befehle und Präfixe
    sms: {
        prefix: "#WK",
        maxLength: 160,
        commands: {
            setup: "SETUP",
            camera: "CAM",
            timer: "TIMER",
            photo: "PHOTO",
            video: "VIDEO",
            status: "STATUS",
            battery: "BATTERY",
            memory: "MEMORY",
            location: "LOCATE",
            powerOn: "POWER=ON",
            powerOff: "POWER=OFF",
            reset: "RESET"
        }
    },
    
    // Benutzeroberflächen-Einstellungen
    ui: {
        theme: {
            primaryColor: "#4CAF50",
            accentColor: "#E91E63",
            backgroundColor: "#f5f5f5"
        },
        animations: {
            enabled: true,
            duration: 300 // ms
        },
        notifications: {
            duration: 4000, // ms
            position: "bottom" // bottom, top
        },
        defaultSort: {
            field: "name",
            direction: "asc" // asc, desc
        }
    }
};

// ------ SMS-Befehlsgeneratoren ------

/**
 * Generiert Befehls-Parameter basierend auf den Einstellungsfeldern
 */
const SMS_PARAM_GENERATORS = {
    // SMS-Fernsteuerung
    smsControl: (value) => {
        return `SMS=${value === 'Sofort' ? 'ON' : 'DAILY'}`;
    },
    
    // SMTP/FTP Bildgröße
    imageSize: (value) => {
        const sizeMap = {
            'Original': 'OR',
            'Klein': 'SM',
            'Größer': 'LA',
            'HD': 'HD'
        };
        return `IMG=${sizeMap[value] || 'OR'}`;
    },
    
    // Statusbericht
    statusReport: (active, time) => {
        if (!active) return 'SREP=OFF';
        return `SREP=${time.replace(':', '')}`;
    },
    
    // Aufnahmemodus
    captureMode: (value) => {
        const modeMap = {
            'Bild': 'IMG',
            'Video': 'VID',
            'P+V': 'BOTH',
            'Bild+Video': 'BOTH'
        };
        return `MODE=${modeMap[value] || 'IMG'}`;
    },
    
    // Nachtmodus
    nightMode: (value) => {
        const nightMap = {
            'Balance': 'BAL',
            'Qualität': 'QUAL',
            'Öko': 'ECO'
        };
        return `NIGHT=${nightMap[value] || 'BAL'}`;
    },
    
    // PIR-Sensibilität
    pirSensitivity: (value) => {
        if (value.startsWith('L')) {
            return `PIR=${value}`;
        }
        
        const pirMap = {
            'Hoch': 'HIGH',
            'Mittel': 'MID',
            'Niedrig': 'LOW'
        };
        return `PIR=${pirMap[value] || 'HIGH'}`;
    },
    
    // Timer
    timer: (active, start, end, number) => {
        if (!active) return `T${number}=OFF`;
        
        const startTime = start.replace(':', '');
        const endTime = end.replace(':', '');
        return `T${number}=${startTime}-${endTime}`;
    },
    
    // Zeitbasierte Einstellungen in Sekunden umrechnen
    timeToSeconds: (timeStr) => {
        const parts = timeStr.split(':');
        if (parts.length === 3) {
            return (parseInt(parts[0]) * 3600) + (parseInt(parts[1]) * 60) + parseInt(parts[2]);
        }
        return 0;
    }
};

// ------ SMS-Parameter nach Kameratyp ------

/**
 * Definiert, welche Parameter für welche Kameratypen verfügbar sind
 */
const CAMERA_TYPE_PARAMETERS = {
    Standard: {
        general: ['smsControl', 'imageSize', 'statusReportSwitch', 'statusTime', 'smtpSwitch', 'ftpMode', 'phone1', 'email1'],
        camera: ['sendImageSwitch', 'sendVideoSwitch', 'captureMode', 'nightMode', 'imageResolution', 'videoResolution', 'pirSensitivity', 'flashLed', 'videoDuration', 'hourSystem', 'burstImages', 'motionSensorSwitch', 'sdCycleSwitch'],
        timer: ['timer1Switch', 'timer1Start', 'timer1End', 'delaySwitch', 'delayTime'],
        allowed: {
            imageResolution: ['12MP', '8MP', '5MP'],
            videoResolution: ['HD-1280x720', 'WVGA-848x480'],
            pirSensitivity: ['Hoch', 'Mittel', 'Niedrig'],
            nightMode: ['Balance', 'Öko']
        }
    },
    
    Pro: {
        general: ['smsControl', 'imageSize', 'statusReportSwitch', 'statusTime', 'maxCountSwitch', 'maxCount', 'mmsControlSwitch', 'smtpSwitch', 'ftpMode', 'phone1', 'phone2', 'email1', 'email2'],
        camera: ['sendImageSwitch', 'sendVideoSwitch', 'captureMode', 'nightMode', 'imageResolution', 'videoResolution', 'pirSensitivity', 'flashLed', 'videoDuration', 'hourSystem', 'burstImages', 'motionSensorSwitch', 'sdCycleSwitch'],
        timer: ['timer1Switch', 'timer1Start', 'timer1End', 'timer2Switch', 'timer2Start', 'timer2End', 'delaySwitch', 'delayTime', 'timelapseSwitch', 'timelapseTime'],
        allowed: {
            imageResolution: ['24M', '12MP', '8MP', '5MP'],
            videoResolution: ['FHD-1920x1080', 'HD-1280x720', 'WVGA-848x480'],
            pirSensitivity: ['Hoch', 'Mittel', 'Niedrig', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'],
            nightMode: ['Balance', 'Qualität', 'Öko']
        }
    },
    
    Max: {
        general: ['smsControl', 'imageSize', 'statusReportSwitch', 'statusTime', 'maxCountSwitch', 'maxCount', 'mmsControlSwitch', 'smtpSwitch', 'ftpMode', 'phone1', 'phone2', 'phone3', 'phone4', 'email1', 'email2', 'email3', 'email4'],
        camera: ['sendImageSwitch', 'sendVideoSwitch', 'captureMode', 'nightMode', 'imageResolution', 'videoResolution', 'pirSensitivity', 'flashLed', 'videoDuration', 'hourSystem', 'burstImages', 'motionSensorSwitch', 'sdCycleSwitch'],
        timer: ['timer1Switch', 'timer1Start', 'timer1End', 'timer2Switch', 'timer2Start', 'timer2End', 'delaySwitch', 'delayTime', 'timelapseSwitch', 'timelapseTime'],
        allowed: {
            imageResolution: ['32M', '24M', '12MP', '8MP', '5MP'],
            videoResolution: ['FHD-1920x1080', 'HD-1280x720', 'WVGA-848x480'],
            pirSensitivity: ['Hoch', 'Mittel', 'Niedrig', 'L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9'],
            nightMode: ['Balance', 'Qualität', 'Öko']
        }
    }
};

// ------ Schnellzugriff-Befehle ------

/**
 * Vordefinierte Befehle für schnellen Zugriff und Musterbeispiele
 */
const QUICK_COMMANDS = {
    photo: {
        name: "Foto anfordern",
        command: "#WK#PHOTO",
        description: "Fordert sofort ein Foto von der Kamera an"
    },
    video10: {
        name: "10s Video anfordern",
        command: "#WK#VIDEO10",
        description: "Fordert ein 10-Sekunden-Video von der Kamera an"
    },
    status: {
        name: "Status abfragen",
        command: "#WK#STATUS",
        description: "Fragt den aktuellen Status der Kamera ab"
    },
    battery: {
        name: "Batterie prüfen",
        command: "#WK#BATTERY",
        description: "Fragt den aktuellen Batteriestand ab"
    },
    highSensitivity: {
        name: "Hohe Empfindlichkeit",
        command: "#WK#CAM;PIR=HIGH",
        description: "Setzt die PIR-Sensibilität auf hoch"
    },
    lowSensitivity: {
        name: "Niedrige Empfindlichkeit",
        command: "#WK#CAM;PIR=LOW",
        description: "Setzt die PIR-Sensibilität auf niedrig"
    },
    nightBalance: {
        name: "Nacht: Balance-Modus",
        command: "#WK#CAM;NIGHT=BAL",
        description: "Setzt den Nachtmodus auf Balance"
    },
    reset: {
        name: "Kamera zurücksetzen",
        command: "#WK#RESET",
        description: "Setzt die Kamera auf Werkseinstellungen zurück"
    }
};

// ------ Exportiere die Konfiguration ------

/**
 * Exportiere alle Konfigurationen als globales config-Objekt
 */
window.config = {
    APP_CONFIG,
    SMS_PARAM_GENERATORS,
    CAMERA_TYPE_PARAMETERS,
    QUICK_COMMANDS
};