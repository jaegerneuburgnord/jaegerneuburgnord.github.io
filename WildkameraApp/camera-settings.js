/**
 * camera-settings.js
 * Enthält erweiterte Funktionen für die Kameraeinstellungen
 */

// ------ Erweiterte Kameraeinstellungen ------

/**
 * Erweiterte Funktion zum Öffnen des Einstellungsmodals mit Kameratyp-spezifischen Optionen
 * @param {Object} camera - Kameraobjekt mit ID, Name und Typ
 */
 

function setupStatusTimeInput() {
    const statusTimeInput = document.getElementById('statusTime');
    
    // Automatische Formatierung und Validierung
    statusTimeInput.addEventListener('input', function(e) {
        // Nur Zahlen und : zulassen
        let value = e.target.value.replace(/[^0-9:]/g, '');
        
        // Automatische Formatierung
        if (value.length > 2 && !value.includes(':')) {
            value = value.slice(0,2) + ':' + value.slice(2);
        }
        
        // Auf 5 Zeichen begrenzen (HH:MM)
        value = value.slice(0, 5);
        
        e.target.value = value;
    });
    
    // Finale Validierung beim Verlassen des Feldes
    statusTimeInput.addEventListener('blur', function(e) {
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        
        if (!timeRegex.test(e.target.value)) {
            // Ungültige Zeit: Standardwert setzen
            e.target.value = '08:00';
            
            // Optional: Benutzer benachrichtigen
            M.toast({html: 'Ungültige Zeitangabe. Standardzeit 08:00 wurde gesetzt.', classes: 'rounded'});
        }
    });
} 
 
function initializeStatusTimepicker() {
    const statusTimeInput = document.getElementById('statusTime');
    
    M.Timepicker.init(statusTimeInput, {
        twelveHour: false,  // 24-Stunden-Format
        defaultTime: '08:00',  // Standardzeit
        autoClose: true,
        onSelect: function(hour, minute) {
            // Formatiere die Zeit immer zweistellig
            const formattedTime = 
                `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            
            statusTimeInput.value = formattedTime;
            
            // Aktualisiere SMS-Vorschau
            updateSmsPreview();
        }
    });
}

// Initialisiere das Max-Anzahl-Feld
function setupMaxCountField() {
    const maxCountField = document.getElementById('maxCount');
    const maxCountSwitch = document.getElementById('maxCountSwitch');
    
    // Initialen Zustand setzen
    if (maxCountField.value === "0" || maxCountField.value === "" || maxCountField.value === "Kein Limit") {
        maxCountField.value = "Kein Limit";
        maxCountSwitch.checked = false;
    } else {
        maxCountSwitch.checked = true;
    }
    
    // Neuer Event Listener zum Löschen des Feldes beim Klick
    maxCountField.addEventListener('click', function() {
        // Nur löschen, wenn der Switch aktiviert ist
        if (maxCountSwitch.checked) {
            if (this.value === "Kein Limit") {
                this.value = "";
            }
        } else {
            // Wenn Switch nicht aktiviert, keine Aktion
            this.value = "Kein Limit";
            return false;
        }
    });

    // Event Listener für das Switch-Element
    maxCountSwitch.addEventListener('change', function() {
        if (this.checked) {
            // Wenn aktiviert, setze einen sinnvollen Standardwert
            if (maxCountField.value === "Kein Limit" || maxCountField.value === "0") {
                maxCountField.value = "10";
            }
            maxCountField.type = "number";
            maxCountField.min = "1";
            maxCountField.max = "99";
        } else {
            // Wenn deaktiviert, setze auf "Kein Limit"
            maxCountField.type = "text";
            maxCountField.value = "Kein Limit";
            maxCountField.removeAttribute("min");
            maxCountField.removeAttribute("max");
        }
        // Aktualisiere die SMS-Vorschau
        updateSmsPreview();
    });    
    
    // Event Listener für Eingabevalidierung
    maxCountField.addEventListener('input', function() {
        if (maxCountSwitch.checked) {
            // Nur wenn der Switch aktiviert ist, als Zahl validieren
            
            // Entferne alle nicht-numerischen Zeichen
            this.value = this.value.replace(/[^0-9]/g, '');
            
            // Stelle sicher, dass mindestens 1 ist
            if (this.value === "" || parseInt(this.value, 10) < 1) {
                this.value = "1";
            }
            
            // Begrenze auf max 99
            if (parseInt(this.value, 10) > 99) {
                this.value = "99";
            }
        }
        
        // Aktualisiere die SMS-Vorschau
        updateSmsPreview();
    });
    
    // Initialer Status setzen
    if (!maxCountSwitch.checked) {
        maxCountField.value = "Kein Limit";
        maxCountField.type = "text";
        maxCountField.removeAttribute("min");
        maxCountField.removeAttribute("max");
    }
}

// Für die SMS-Vorschau bzw. das eigentliche Kommando benötigst du eine Helper-Funktion:
function getMaxCountValue() {
    const maxCountField = document.getElementById('maxCount');
    const maxCountSwitch = document.getElementById('maxCountSwitch');
    
    if (!maxCountSwitch.checked || maxCountField.value === "Kein Limit") {
        return 0; // 0 bedeutet "Kein Limit" im SMS-Kommando
    }
    
    return parseInt(maxCountField.value, 10);
}

async function openSettingsModal(camera) {
    currentCameraId = camera.id;
    
    // Kamera-Namen im Modal anzeigen
    document.getElementById('settingsCameraName').textContent = camera.name;
    
    // Einstellungen aus der Datenbank laden
    try {
        const settings = await dbManager.getSettings(camera.id);
        
        if (settings) {
            // Formular mit gespeicherten Einstellungen füllen
            fillSettingsForm(settings);
        } else {
            // Standardwerte setzen
            initializeSettingsForm();
        }
        
        // Kameratyp-spezifische Anpassungen vornehmen
        adjustSettingsBasedOnCameraType(camera.type);
        setupLiveSettingsPreview();
    } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
        // Standardwerte setzen
        initializeSettingsForm();
        // Kameratyp-spezifische Anpassungen vornehmen
        adjustSettingsBasedOnCameraType(camera.type);

    }
    
    // Modal öffnen
    const modal = M.Modal.getInstance(document.getElementById('settingsModal'));
    modal.open();
    
	
	// Warten, bis das Modal vollständig geöffnet ist
	setTimeout(() => {
		// Timepicker initialisieren
		const timepickers = document.querySelectorAll('.timepicker');
		timepickers.forEach(timepicker => {
			let instance = M.Timepicker.getInstance(timepicker);
			if (instance) {
				instance.destroy();  // Vorherige Instanz zerstören, falls vorhanden
			}
			M.Timepicker.init(timepicker, {
				twelveHour: false,
				defaultTime: '08:00',
				autoClose: true,
				container: 'body'  // Ändern Sie dies
			});
		});
		
		// SMS-Vorschau aktualisieren
		updateSmsPreview();
	}, 300);
	
}

/**
 * Passt die Einstellungen basierend auf dem Kameratyp an
 * @param {string} cameraType - Typ der Kamera (Standard, Pro, Max)
 */
function adjustSettingsBasedOnCameraType(cameraType) {
    // Referenzen zu allen Einstellungsoptionen
    const elements = {
        // Allgemeine Einstellungen
        mmsControl: document.getElementById('mmsControlSwitch'),
        mmsControlRow: document.getElementById('mmsControlSwitch').closest('.setting-row'),
        ftpMode: document.getElementById('ftpMode'),
        
        // Kamera-Einstellungen
        videoRes: document.getElementById('videoResolution'),
        imageRes: document.getElementById('imageResolution'),
        pirSensitivity: document.getElementById('pirSensitivity'),
        
        // Timer-Einstellungen
        timerSettings: document.getElementById('timerSettings'),
        timelapseSwitch: document.getElementById('timelapseSwitch'),

        // Phone-Einträge
        phoneFields: [
            document.getElementById('phone1'),
            document.getElementById('phone2'),
            document.getElementById('phone3'),
            document.getElementById('phone4')
        ]
    };
    
    // Standardkonfiguration (alle Funktionen eingeschränkt)
    if (cameraType === '24MP') {
        // Standardeinstellungen für 24MP Modell
        elements.mmsControl.disabled = false;
        elements.mmsControlRow.style.display = 'flex';        

        // Begrenze Videoauflösung
        // limitSelectOptions(elements.videoRes, ['HD-1280x720', 'WVGA-848x480']);
        // Begrenze Bildauflösung
        limitSelectOptions(elements.imageRes, ['24MP', '12MP', '8MP', '5MP']);
        
        // Standardwerte setzen
        //elements.videoRes.value = 'HD-1280x720';
        elements.imageRes.value = '24MP';
        
        // Timer-Optionen einschränken
        // elements.timelapseSwitch.disabled = true;
        // elements.timelapseSwitch.parentElement.parentElement.parentElement.classList.add('disabled-setting');

        // Phone-Felder wieder sichtbar machen
        elements.phoneFields.forEach(field => {
            const parentRow = field.closest('.setting-row');
            if (parentRow) {
                parentRow.style.display = 'flex';
            }
        });
    }
    // Pro-Modell (mittlere Funktionalität)
    else if (cameraType === '32MP') {
        // Pro-Modell hat Zugriff auf mehr Optionen
        elements.mmsControl.disabled = true;
        elements.mmsControlRow.style.display = 'none';

        // Erweiterte Videoauflösung
        //resetSelectOptions(elements.videoRes, [
        //    {value: 'FHD-1920x1080', text: 'FHD-1920x1080'},
        //    {value: 'HD-1280x720', text: 'HD-1280x720'},
        //    {value: 'WVGA-848x480', text: 'WVGA-848x480'}
        //]);
        
        // Erweiterte Bildauflösung
        resetSelectOptions(elements.imageRes, [
            {value: '32M', text: '32M'},
            {value: '24M', text: '24M'},
            {value: '12MP', text: '12MP'},
            {value: '8MP', text: '8MP'},
            {value: '5MP', text: '5MP'}
        ]);
        
        // Timer-Optionen freischalten
        // elements.timelapseSwitch.disabled = false;
        // elements.timelapseSwitch.parentElement.parentElement.parentElement.classList.remove('disabled-setting');

        // Phone-Felder unsichtbar machen
        elements.phoneFields.forEach(field => {
            const parentRow = field.closest('.setting-row');
            if (parentRow) {
                parentRow.style.display = 'none';
            }
        });
    }
    // Max-Modell (volle Funktionalität)
    else if (cameraType === 'Max') {
        // Max-Modell hat Zugriff auf alle Optionen
        elements.mmsControl.disabled = false;
        elements.mmsControl.parentElement.parentElement.classList.remove('disabled-setting');
        
        // Volle Videoauflösung
        resetSelectOptions(elements.videoRes, [
            {value: 'FHD-1920x1080', text: 'FHD-1920x1080'},
            {value: 'HD-1280x720', text: 'HD-1280x720'},
            {value: 'WVGA-848x480', text: 'WVGA-848x480'}
        ]);
        
        // Volle Bildauflösung
        resetSelectOptions(elements.imageRes, [
            {value: '32M', text: '32M'},
            {value: '24M', text: '24M'},
            {value: '12MP', text: '12MP'},
            {value: '8MP', text: '8MP'},
            {value: '5MP', text: '5MP'}
        ]);
        
        // Alle Timer-Optionen freischalten
        elements.timelapseSwitch.disabled = false;
        elements.timelapseSwitch.parentElement.parentElement.parentElement.classList.remove('disabled-setting');
    }
    
    // Selects neu initialisieren nach Änderungen
    M.FormSelect.init(document.querySelectorAll('select'));
}

/**
 * Begrenzt die Optionen eines Select-Elements auf bestimmte Werte
 * @param {HTMLSelectElement} selectElement - Das Select-Element
 * @param {Array<string>} allowedValues - Array mit erlaubten Optionswerten
 */
function limitSelectOptions(selectElement, allowedValues) {
    if (!selectElement) return;
    
    // Alle Optionen durchgehen und nicht erlaubte ausblenden
    Array.from(selectElement.options).forEach(option => {
        if (!allowedValues.includes(option.value)) {
            option.disabled = true;
            option.style.display = 'none';
        } else {
            option.disabled = false;
            option.style.display = '';
        }
    });
    
    // Wenn der aktuelle Wert nicht erlaubt ist, den ersten erlaubten wählen
    if (!allowedValues.includes(selectElement.value)) {
        selectElement.value = allowedValues[0];
    }
}

/**
 * Setzt die Optionen eines Select-Elements zurück und füllt es mit neuen Optionen
 * @param {HTMLSelectElement} selectElement - Das Select-Element
 * @param {Array<{value: string, text: string}>} options - Array mit Optionsobjekten
 */
function resetSelectOptions(selectElement, options) {
    if (!selectElement) return;
    
    // Alle Optionen zurücksetzen
    Array.from(selectElement.options).forEach(option => {
        option.disabled = false;
        option.style.display = '';
    });
    
    // Wenn neue Optionen angegeben wurden und nicht bereits vorhanden sind
    if (options && selectElement.options.length !== options.length) {
        // Bestehende Optionen entfernen
        selectElement.innerHTML = '';
        
        // Neue Optionen hinzufügen
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.value;
            option.textContent = opt.text;
            selectElement.appendChild(option);
        });
    }
}


function setupCaptureModeHandler() {
    const captureModeSelect = document.getElementById('captureMode');
    const sendVideoSwitch = document.getElementById('sendVideoSwitch');
    const sendImageSwitch = document.getElementById('sendImageSwitch')

    captureModeSelect.addEventListener('change', function() {
        // Wenn Aufnahmemodus "Bild" ist
        if (this.value === 'Bild') {
            // Deaktiviere den Versand Video Switch
            sendVideoSwitch.checked = false;
        }
        // Wenn Aufnahmemodus "Bild" ist
        if (this.value === 'Video') {
            // Deaktiviere den Versand Video Switch
            sendImageSwitch.checked = false;
        }
    });

    // Optional: Umgekehrte Logik - wenn Video-Versand aktiviert wird, 
    // stelle sicher, dass nicht nur Bild-Modus aktiv ist
    sendVideoSwitch.addEventListener('change', function() {
        if (this.checked) {
            const captureMode = captureModeSelect.value;
            if (captureMode === 'Bild') {
                // Ändere den Capture-Modus zu 'P+V' oder 'Video'
                captureModeSelect.value = 'P+V';
                
                // Materialize Select neu initialisieren
                M.FormSelect.init(captureModeSelect);
            }
        }
    });

    sendImageSwitch.addEventListener('change', function() {
        if (this.checked) {
            const captureMode = captureModeSelect.value;
            if (captureMode === 'Video') {
                // Ändere den Capture-Modus zu 'P+V' oder 'Video'
                captureModeSelect.value = 'P+V';
                
                // Materialize Select neu initialisieren
                M.FormSelect.init(captureModeSelect);
            }
        }
    });

}

// ------ Live-Vorschau für Einstellungsänderungen ------

/**
 * Richtet Live-Vorschau für Einstellungsänderungen ein
 */
function setupLiveSettingsPreview() {
    // Event Listener für alle Einstellungsänderungen
    const settingsInputs = document.querySelectorAll('#settingsModal input, #settingsModal select');
    
    settingsInputs.forEach(input => {
        // Event Listener für Änderungen
        input.addEventListener('change', () => {
            // Vorschau aktualisieren
            updateSmsPreview();
            
            // Visuelles Feedback für die Änderung
            highlightChangedSetting(input);
        });
    });
    
    // Spezielle Handler für Range-Slider
    const rangeInputs = document.querySelectorAll('input[type=range]');
    rangeInputs.forEach(range => {
        range.addEventListener('input', () => {
            // Aktualisiere den angezeigten Wert in Echtzeit
            if (range.id === 'burstImages') {
                document.getElementById('burstImagesValue').textContent = range.value + 'P';
            }
            updateSmsPreview();
        });
    });
	
	// Initialisierung für das Max-Anzahl-Feld
	setupMaxCountField();
	initializeStatusTimepicker()
    setupCaptureModeHandler();

}

/**
 * Hebt eine geänderte Einstellung visuell hervor
 * @param {HTMLElement} element - Das geänderte Eingabeelement
 */
function highlightChangedSetting(element) {
    // Findet das übergeordnete setting-row Element
    const settingRow = element.closest('.setting-row');
    if (!settingRow) return;
    
    // Animation für Hervorhebung
    settingRow.classList.add('highlight-setting');
    
    // Nach der Animation wieder entfernen
    setTimeout(() => {
        settingRow.classList.remove('highlight-setting');
    }, 1000);
}

/**
 * Verbesserte SMS-Vorschau mit Längenwarnungen
 */
function updateSmsPreview() {
    const smsPreview = document.getElementById('smsPreviewText');
    
    // Aktive Tab ermitteln
    let activeTab = '';
    const tabLinks = document.querySelectorAll('.tabs .tab a');
    tabLinks.forEach(tab => {
        if (tab.classList.contains('active')) {
            activeTab = tab.getAttribute('href').substring(1);
        }
    });
    
    let previewText = '';
    
    // Je nach aktivem Tab unterschiedliche Befehle zusammenbauen
    switch (activeTab) {
        case 'generalSettings':
            previewText = buildSmsCommand('general');
            break;
        case 'cameraSettings':
            previewText = buildSmsCommand('camera');
            break;
        case 'timerSettings':
            previewText = buildSmsCommand('timer');
            break;
        case 'recipientSettings':
            previewText = buildSmsCommand('email');
            break;
        default:
            previewText = buildSmsCommand('general');
    }
    
    // SMS-Länge berechnen
    const smsLength = previewText.length;
    const smsCount = Math.ceil(smsLength / 160);
    
    // SMS-Text mit Längenanzeige aktualisieren
    smsPreview.textContent = previewText;
    
    // SMS-Längenwarnung hinzufügen
    const lengthIndicator = document.getElementById('smsLengthIndicator') || document.createElement('div');
    lengthIndicator.id = 'smsLengthIndicator';
    
    // Styling basierend auf SMS-Anzahl
    let lengthClass = 'length-ok';
    if (smsCount > 1) lengthClass = 'length-warning';
    if (smsCount > 2) lengthClass = 'length-error';
    
    lengthIndicator.className = `sms-length-indicator ${lengthClass}`;
    lengthIndicator.textContent = `${smsLength} Zeichen (${smsCount} SMS)`;
    
/**
 * Fortsetzung von camera-settings.js
 */

    // Wenn das Element noch nicht existiert, zur Vorschau hinzufügen
    if (!document.getElementById('smsLengthIndicator')) {
        const smsPreviewContainer = document.querySelector('.sms-preview');
        smsPreviewContainer.appendChild(lengthIndicator);
    }
}

// Exportiere Funktionen für die Verwendung in app.js
window.cameraSettings = {
    openSettingsModal,
    adjustSettingsBasedOnCameraType,
    setupLiveSettingsPreview,
    updateSmsPreview
};    

/**
 * Füllt das Einstellungsformular mit den gegebenen Einstellungen
 * @param {Object} settings - Objekt mit den Kameraeinstellungen
 */
function fillSettingsForm(settings) {
    // Durchlaufe alle Properties im settings-Objekt
    for (const [key, value] of Object.entries(settings)) {
        const element = document.getElementById(key);
        
        // Wenn Element existiert, setze den Wert entsprechend dem Typ
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = Boolean(value);
            } else {
                element.value = value;
            }
        }
    }
    
    // Aktualisiere Materialize-Komponenten
    M.updateTextFields();
    M.FormSelect.init(document.querySelectorAll('select'));
    
    // Aktualisiere ggf. angezeigten Wert für Serienbilder
    const burstSlider = document.getElementById('burstImages');
    if (burstSlider) {
        document.getElementById('burstImagesValue').textContent = burstSlider.value + 'P';
    }
	
	// Initialisieren der Timepicker-Elemente
	const timepickers = document.querySelectorAll('.timepicker');
	M.Timepicker.init(timepickers, {
		twelveHour: false,  // 24-Stunden-Format
		defaultTime: '08:00',  // Standardzeit
		autoClose: true,
		container: 'body',  // Ändern Sie dies
		onSelect: function(hour, minute) {
			// Optional: Callback wenn Zeit ausgewählt wurde
			updateSmsPreview();
		}
	});
	
	
    // Spezielle Behandlung für das Max-Anzahl-Feld
    const maxCountField = document.getElementById('maxCount');
    const maxCountSwitch = document.getElementById('maxCountSwitch');
    
    if (settings.maxCount && parseInt(settings.maxCount) > 0) {
        maxCountField.value = settings.maxCount;
        maxCountSwitch.checked = true;
        maxCountField.type = "number";
        maxCountField.min = "1";
        maxCountField.max = "99";
    } else {
        maxCountField.value = "Kein Limit";
        maxCountSwitch.checked = false;
        maxCountField.type = "text";
        maxCountField.removeAttribute("min");
        maxCountField.removeAttribute("max");
    }	
}