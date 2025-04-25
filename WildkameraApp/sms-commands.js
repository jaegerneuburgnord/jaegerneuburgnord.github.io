/**
 * sms-commands.js
 * Enthält Funktionen zum Erstellen der SMS-Steuerkommandos für Wildkameras
 * Basierend auf der WildkameraAPI und unterstützt das klassische $-Befehlsformat
 */

// Mapping der Bildauflösung zu Kommandowerten
const IMAGE_RESOLUTION_MAP = {
    '32M': 1,
    '24M': 2,
    '12MP': 3,
    '8MP': 4,
    '5MP': 5
};

// Mapping der Videoauflösung zu Kommandowerten
const VIDEO_RESOLUTION_MAP = {
    'FHD-1920x1080': 1,
    'HD-1280x720': 2,
    'WVGA-848x480': 3
};

/**
 * Erstellt ein allgemeines Konfigurationskommando (Kommando 10)
 * @returns {string} - Formatiertes Kommando
 */
function createGeneralConfig() {
    const cameraType = document.getElementById('cameraType').value; // → "24MP" oder "32MP"

    const smsControl = document.getElementById('smsControl').value === 'Sofort' ? 1 : 0;
    
    let imageSize = 2; // Original (Standard)
    switch (document.getElementById('imageSize').value) {
        case 'Klein':
            imageSize = 0;
            break;
        case 'Größer':
            imageSize = 1;
            break;
    }
    
    // Max Anzahl der Bilder
    const maxCountActive = document.getElementById('maxCountSwitch').checked;
    // const maxCount = maxCountActive ? parseInt(document.getElementById('maxCount').value) || 0 : 0;
    const maxCount = getMaxCountValue()
	
    // Statusbericht
    const statusActive = document.getElementById('statusReportSwitch').checked;
    //const statusTime = statusActive ? document.getElementById('statusTime').value.replace(':', '') : 'OFF';
    const statusTime = statusActive ? document.getElementById('statusTime').value : 'OFF';
    
    // MMS Fernsteuerung
    mmsControl = document.getElementById('mmsControlSwitch').checked ? 1 : 0;
    if (cameraType=="32MP") {
        mmsControl = 1;
    }

    // Send Mails
    const smtpActive = document.getElementById('smtpSwitch').checked ? 1: 0; 
    
    // FTP-Einstellungen
    let ftpSetting = 0;                          // Standard = AUS
    const ftpModeVal = document.getElementById('ftpMode').value;
    switch (ftpModeVal) {
        case 'FTP':
            ftpSetting = 1;
            break;
        case 'FTPS':
            ftpSetting = 2;
            break;
    }
    
    // Nicht dokumentierte Parameter mit Platzhalter
    const placeholder = '0';
    
    return `$10*13#${smsControl}#${imageSize}#${maxCount}#${statusTime}#${placeholder}#${placeholder}#${mmsControl}#${smtpActive}#${ftpSetting}#${placeholder}#${placeholder}#${placeholder}#${placeholder}$`;
}

/**
 * Konfiguriert Telefonnummern für die Bildweiterleitung (Kommando 06)
 * @returns {string} - Formatiertes Kommando
 */
function setPhoneNumbers() {
    const phone1 = document.getElementById('phone1').value || '0';
    
    // Weitere Telefonnummern könnten hier hinzugefügt werden, wenn UI-Elemente vorhanden sind
    const phones = [phone1, '0', '0', '0', '0', '0', '0', '0'];
    
    return `$06*8#${phones.join('#')}$`;
}

/**
 * Konfiguriert E-Mail-Adressen für die Bildweiterleitung (Kommando 08)
 * @returns {string} - Formatiertes Kommando
 */
function setEmailAddresses() {
    const email1 = document.getElementById('email1').value || '';
    const email2 = document.getElementById('email2').value || '';
    const email3 = document.getElementById('email3').value || '';
    const email4 = document.getElementById('email4').value || '';
    
    // Weitere E-Mail-Adressen könnten hier hinzugefügt werden, wenn UI-Elemente vorhanden sind
    const emails = [email1, email2, email3, email4, '0', '0', '0', '0'];
    
    return `$08*8#${emails.join('#')}$`;
}

/**
 * Löst manuell eine Bildaufnahme aus (Kommando 03)
 * @returns {string} - Formatiertes Kommando
 */
function triggerCapture() {
    return '$03*1#1$';
}

/**
 * Erstellt eine detaillierte Kamerakonfiguration (Kommando 01)
 * @returns {string} - Formatiertes Kommando
 */
function createDetailedConfig() {
    // Aufnahmemodus
    let captureMode = 1; // Standard: Bild
    switch (document.getElementById('captureMode').value) {
        case 'Video':
            captureMode = 2;
            break;
        case 'P+V':
        case 'Bild+Video':
            captureMode = 3;
            break;
    }
    
    // Bildauflösung
    const imageResValue = document.getElementById('imageResolution').value;
    const imageResolution = IMAGE_RESOLUTION_MAP[imageResValue] || 5;
    
    // Videoauflösung
    const videoResValue = document.getElementById('videoResolution').value;
    const videoResolution = VIDEO_RESOLUTION_MAP[videoResValue] || 2;
    
    // Video-Dauer
    const videoDuration = parseInt(document.getElementById('videoDuration').value) || 5;
    
    // Serienbilder
    const burstImages = parseInt(document.getElementById('burstImages').value) || 1;
    
    // Blitz-LED
    const flashLed = document.getElementById('flashLed').value === 'Hoch' ? 0 : 1;
    
    // Bewegungssensor
    const motionSensor = document.getElementById('motionSensorSwitch').checked ? 0 : 1;
    
    // SD-Zyklus
    const sdCycle = document.getElementById('sdCycleSwitch').checked ? 1 : 0;
    
    // PIR-Sensibilität
    const pirValue = document.getElementById('pirSensitivity').value;
    let pirSensitivity = 7; // Standard: L7
    if (pirValue.startsWith('L')) {
        pirSensitivity = parseInt(pirValue.substring(1)) || 7;
    } else {
        // Umwandlung von 'Hoch', 'Mittel', 'Niedrig' in Werte
        switch (pirValue) {
            case 'Hoch':
                pirSensitivity = 9;
                break;
            case 'Mittel':
                pirSensitivity = 7;
                break;
            case 'Niedrig':
                pirSensitivity = 5;
                break;
        }
    }
    
    // Timer-Einstellungen
    const timer1Active = document.getElementById('timer1Switch').checked;
    const timer1Start = document.getElementById('timer1Start').value || '00:00';
    const timer1End = document.getElementById('timer1End').value || '00:00';
    const timer1Value = timer1Active ? `${timer1Start.replace(':', '')}-${timer1End.replace(':', '')}` : 'OFF';
    
    const timer2Active = document.getElementById('timer2Switch').checked;
    const timer2Start = document.getElementById('timer2Start').value || '00:00';
    const timer2End = document.getElementById('timer2End').value || '00:00';
    const timer2Value = timer2Active ? `${timer2Start.replace(':', '')}-${timer2End.replace(':', '')}` : 'OFF';
    
    // Verzögerung
    const delayActive = document.getElementById('delaySwitch').checked;
    const delayTime = document.getElementById('delayTime').value || '00:00:00';
    const delayValue = delayActive ? delayTime : 'OFF';
    
    // Zeitraffer
    const timelapseActive = document.getElementById('timelapseSwitch').checked;
    const timelapseTime = document.getElementById('timelapseTime').value || '00:00:00';
    const timelapseValue = timelapseActive ? timelapseTime : 'OFF';
    
    // Versand Bild/Video
    const sendImage = document.getElementById('sendImageSwitch').checked ? 1 : 0;
    let sendVideo = document.getElementById('sendVideoSwitch').checked ? 1 : 0;
    
    // Wichtig: Bei Videodauer > 10s muss sendVideo auf 0 gesetzt sein
    if (videoDuration > 10) {
        sendVideo = 0;
    }
    
    // Stundensystem
    const hourSystem = document.getElementById('hourSystem').value === '12h' ? 1 : 0;
    
    // Serienbilder als Bitmuster für den Versand
    let burstToSend = 1; // Standardmäßig nur das erste Bild
    if (burstImages >= 5) {
        burstToSend = 31; // Alle 5 Bilder
    } else if (burstImages > 1) {
        burstToSend = 15; // Bilder 1-4
    }
    
    // Standardwerte für nicht-dokumentierte Parameter
    const param6 = 2;
    const param8 = 1;
    const param11 = 0;
    const param13 = 0;
    const param14 = 0;
    const param22 = "OFF";
    const param23 = "OFF";
    const param25 = 0;
    const param26 = 0;
    const param27 = 0;
    
    return `$01*27#${captureMode}#${imageResolution}#${videoResolution}#${videoDuration}#${burstImages}#${param6}#${flashLed}#${param8}#${motionSensor}#${sdCycle}#${param11}#${pirSensitivity}#${param13}#${param14}#${delayValue}#${timelapseValue}#${timer1Value}#${timer2Value}#${sendImage}#${sendVideo}#${burstToSend}#${param22}#${param23}#${hourSystem}#${param25}#${param26}#${param27}$`;
}

/**
 * Erstellt eine Konfiguration für reinen Bildmodus
 * @returns {string} - Formatiertes Kommando
 */
function createImageOnlyConfig() {
    // Setze Formulardaten für Bild-Modus
    document.getElementById('captureMode').value = 'Bild';
    document.getElementById('sendImageSwitch').checked = true;
    document.getElementById('sendVideoSwitch').checked = false;
    
    return createDetailedConfig();
}

/**
 * Erstellt eine Konfiguration für reinen Videomodus
 * @returns {string} - Formatiertes Kommando
 */
function createVideoOnlyConfig() {
    // Setze Formulardaten für Video-Modus
    document.getElementById('captureMode').value = 'Video';
    document.getElementById('sendImageSwitch').checked = false;
    
    // Videodauer prüfen und ggf. sendVideo anpassen
    const videoDuration = parseInt(document.getElementById('videoDuration').value) || 5;
    document.getElementById('sendVideoSwitch').checked = (videoDuration <= 10);
    
    return createDetailedConfig();
}

/**
 * Erstellt eine Konfiguration für kombinierten Bild- und Videomodus
 * @returns {string} - Formatiertes Kommando
 */
function createImageAndVideoConfig() {
    // Setze Formulardaten für Bild+Video-Modus
    document.getElementById('captureMode').value = 'P+V';
    document.getElementById('sendImageSwitch').checked = true;
    
    // Videodauer prüfen und ggf. sendVideo anpassen
    const videoDuration = parseInt(document.getElementById('videoDuration').value) || 5;
    document.getElementById('sendVideoSwitch').checked = (videoDuration <= 10);
    
    return createDetailedConfig();
}

/**
 * Erstellt eine Konfiguration mit Timer 1
 * @param {string} timeRange - Zeitraum im Format "HH:MM-HH:MM"
 * @returns {string} - Formatiertes Kommando
 */
function createTimer1Config(timeRange) {
    // Zeitraum in Start und Ende aufteilen
    const [start, end] = timeRange.split('-');
    
    // Timer-Formularfelder setzen
    document.getElementById('timer1Switch').checked = true;
    document.getElementById('timer1Start').value = start;
    document.getElementById('timer1End').value = end;
    
    return createDetailedConfig();
}

/**
 * Erstellt eine Konfiguration mit Timer 2
 * @param {string} timeRange - Zeitraum im Format "HH:MM-HH:MM"
 * @returns {string} - Formatiertes Kommando
 */
function createTimer2Config(timeRange) {
    // Zeitraum in Start und Ende aufteilen
    const [start, end] = timeRange.split('-');
    
    // Timer-Formularfelder setzen
    document.getElementById('timer2Switch').checked = true;
    document.getElementById('timer2Start').value = start;
    document.getElementById('timer2End').value = end;
    
    return createDetailedConfig();
}

/**
 * Erstellt eine Konfiguration mit Verzögerung
 * @param {string} delayTime - Verzögerung im Format "HH:MM:SS"
 * @returns {string} - Formatiertes Kommando
 */
function createDelayConfig(delayTime) {
    // Verzögerungs-Formularfelder setzen
    document.getElementById('delaySwitch').checked = true;
    document.getElementById('delayTime').value = delayTime;
    
    return createDetailedConfig();
}

/**
 * Erstellt eine Konfiguration mit Zeitraffer
 * @param {string} timelapseInterval - Zeitraffer-Intervall im Format "HH:MM:SS"
 * @returns {string} - Formatiertes Kommando
 */
function createTimelapseConfig(timelapseInterval) {
    // Zeitraffer-Formularfelder setzen
    document.getElementById('timelapseSwitch').checked = true;
    document.getElementById('timelapseTime').value = timelapseInterval;
    
    return createDetailedConfig();
}

/**
 * Erstellt eine Konfiguration für HD-Video längerer Dauer (ohne Versand)
 * @param {number} duration - Videodauer in Sekunden (15, 20, 30, 40, 50, 59)
 * @returns {string} - Formatiertes Kommando
 */
function createLongVideoConfig(duration) {
    // Überprüfe, ob die Dauer ein gültiger Wert für längere Videos ist
    const validDurations = [15, 20, 30, 40, 50, 59];
    const validDuration = validDurations.includes(duration) ? duration : 30;
    
    // Formularfelder setzen
    document.getElementById('captureMode').value = 'Video';
    document.getElementById('sendImageSwitch').checked = false;
    document.getElementById('sendVideoSwitch').checked = false; // Muss 0 sein bei längerer Dauer
    document.getElementById('videoDuration').value = validDuration + 's';
    
    // Bei längeren Videos, HD oder WVGA verwenden (nicht FHD)
    if (document.getElementById('videoResolution').value === 'FHD-1920x1080') {
        document.getElementById('videoResolution').value = 'HD-1280x720';
    }
    
    return createDetailedConfig();
}

/**
 * Hauptfunktion zum Erstellen von SMS-Kommandos basierend auf dem Formular
 * @param {string} commandType - Art des Kommandos (general, photo, etc.)
 * @returns {string} - Formatiertes Kommando
 */
function buildSmsCommand(commandType) {
    switch (commandType) {
        case 'general':
            return createGeneralConfig();
        case 'photo':
            return triggerCapture();
        case 'email':
            return setEmailAddresses();
        case 'phone':
            return setPhoneNumbers();
        case 'camera':
            return createDetailedConfig();
        case 'timer':
            return createDetailedConfig();
        case 'image_only':
        return createImageOnlyConfig();
        case 'video_only':
            return createVideoOnlyConfig();
        case 'image_video':
            return createImageAndVideoConfig();
        case 'long_video':
            const duration = parseInt(document.getElementById('videoDuration').value) || 30;
            return createLongVideoConfig(duration);
        default:
            // Standardmäßig Status-Kommando zurückgeben
            return '$03*1#1$';
    }
}

/**
 * Aktualisiert die Vorschau des SMS-Kommandos
 */
function updateSmsPreview() {
    const command = createDetailedConfig();
    const previewElement = document.getElementById('smsPreviewText');
    if (previewElement) {
        previewElement.textContent = command;
    }
}

// Exportiere die Funktionen für die Verwendung in anderen Modulen
window.buildSmsCommand = buildSmsCommand;
window.updateSmsPreview = updateSmsPreview;

// Event-Listener für alle Formularelemente hinzufügen, um die Vorschau zu aktualisieren
document.addEventListener('DOMContentLoaded', function() {
    const formElements = document.querySelectorAll('#settingsModal input, #settingsModal select');
    formElements.forEach(element => {
        element.addEventListener('change', updateSmsPreview);
    });
    
    // Initial die Vorschau aktualisieren
    updateSmsPreview();
});