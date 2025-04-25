/**
 * app.js
 * Hauptdatei für die Wildkamera-PWA mit Integration aller Module
 */

// Globale Variablen
let currentCameraId = null;
let cameras = [];
let batchMode = false;
let selectedIds = new Set();
let sendMultiple = false

// PWA-Funktionalität
let deferredPrompt;
const installButton = document.getElementById('installButton');

// Service Worker registrieren
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(reg => {
        console.log('Service Worker registered successfully:', reg);
        console.log('Scope:', reg.scope);
      })
      .catch(err => {
        console.error('Service Worker registration failed:', err);
      });
  });
}
// Funktion zum Update-Check
function checkForServiceWorkerUpdate() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(registration => {
      registration.active.postMessage('CHECK_FOR_UPDATE');
    });
  }
}


// PWA Installation ermöglichen
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  installButton.classList.remove('hide');
});
installButton.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  console.log(`Installation Ergebnis: ${outcome}`);
  deferredPrompt = null;
  installButton.classList.add('hide');
});
window.addEventListener('appinstalled', () => {
  console.log('PWA wurde installiert');
  installButton.classList.add('hide');
});

// DOMContentLoaded: Module holen & initialisieren
document.addEventListener('DOMContentLoaded', async () => {
  const dbManager   = window.dbManager;
  const smsManager  = window.smsManager;
  const syncManager = window.syncManager;

  initMaterializeComponents();
  setupEventListeners();

  await loadCameras();
  await syncManager.checkPendingSMS();
  syncManager.setupNetworkStatus();
  
  document.getElementById('batchActionBar').classList.add('hide');


  // Existing tab initialization
  const tabElements = document.querySelectorAll('.tabs');
  const tabInstances = M.Tabs.init(tabElements, {
    // Add an onShow callback to regenerate SMS preview when switching tabs
    onShow: function(selectedTab) {
      // Call the updateSmsPreview function to regenerate the command
      updateSmsPreview();
    }
  });

	// ganz unten in Deinem DOMContentLoaded‑Callback
	const batchBar = document.getElementById('batchActionBar');

	base = ""
	baseSet = false
	settingsShown = false
	sendMultiple = false
	
	// Batch‑Actions (photo / delete / rename / settings) auf alle selectedIds
	document.querySelectorAll('.batch-action').forEach(btn => {
	  btn.addEventListener('click', async (e) => {
		e.stopPropagation();
		const action = btn.dataset.action;
		if (!selectedIds.size) return;

		for (const id of selectedIds) {
		  const cam = cameras.find(c => c.id === id);
		  if (!cam) continue;

		  switch (action) {
		  case 'photo':
			// BEGINN Patch hier
			// 1. Sammle alle Nummern der selektierten Kameras
			const phones = Array.from(selectedIds)
			  .map(id => {
				const cam = cameras.find(c => c.id === id);
				return cam && cam.phone;
			  })
			  .filter(Boolean);

			if (phones.length) {
			  // 2. Baue den sms:-Link (iOS/neuere Androids mit Komma getrennt)
			  const recipients = phones.join(',');
			  const smsLink = `sms:${recipients}?body=${encodeURIComponent('$03*1#1$')}`;

			  // 3a. Direkt öffnen:
			  window.location.href = smsLink;

			  // — oder —
			  // 3b. In einen <a id="batchSmsLink"> schreiben:
			  // document.getElementById('batchSmsLink').href = smsLink;
			}
			// ENDE Patch
			break;
		case 'settings':
			  // öffne Einstellungen‑Modal für alle Kameras nacheinander
			  if (settingsShown == false) {
				openSettingsModal(cam);		
				sendMultiple = true
			  }
			  settingsShown=true
			  
			  break;
			case 'rename':
			  // Beispiel: neuen Namen holen (z.B. via prompt) und dann durchnummeriert speichern
			  // const base = prompt('Basis‑Name für alle Kameras');
			  if (baseSet == false) {
				base = prompt('Basis‑Name für alle Kameras');
			  }
			  
			  baseSet = true
			  
			  if (base) {
				let idx = 1;
				for (const cid of selectedIds) {
				  const c = cameras.find(x=>x.id===cid);
				  const newCam = { ...c, name: `${base} ${idx++}` };
				  await dbManager.saveCamera(newCam);
				}
				renderCameraList();
			  }
			  break;
			case 'delete':
			  // alle löschen
			  for (const cid of Array.from(selectedIds)) {
				await dbManager.deleteCamera(cid);
			  }
			  cameras = cameras.filter(c=>!selectedIds.has(c.id));
			  renderCameraList();
			  selectedIds.clear();
			  updateBatchBar();
			  break;
		  }
		}

		// nach Foto‑Anfragen kannst Du die Auswahl stehen lassen,
		// oder sie aufheben:
		// selectedIds.clear();
		// updateBatchBar();
	  });
	});
	
	  // Fügen Sie dies am Ende hinzu
	  checkForServiceWorkerUpdate();


});

// Materialize Komponenten initialisieren
function initMaterializeComponents() {
  M.Modal.init(document.querySelectorAll('.modal'));
  M.FormSelect.init(document.querySelectorAll('select'));
  M.Tabs.init(document.querySelectorAll('.tabs'));
  M.Timepicker.init(document.querySelectorAll('.timepicker'), { twelveHour: false, defaultTime: '00:00', autoClose: true });
  M.Range.init(document.querySelectorAll('input[type=range]'));
}


// Event-Listener für Buttons einrichten
function setupEventListeners() {
  document.getElementById('addCameraButton').addEventListener('click', () => openCameraModal());
  document.getElementById('saveCameraButton').addEventListener('click', saveCamera);
  document.getElementById('sendSettingsButton').addEventListener('click', sendSettings);
  document.getElementById('settingsModal').addEventListener('show', () => initializeSettingsForm());

  const burstSlider = document.getElementById('burstImages');
  if (burstSlider) burstSlider.addEventListener('input', () => updateSmsPreview());
  document.querySelectorAll('#settingsModal input, #settingsModal select')
    .forEach(el => el.addEventListener('change', updateSmsPreview));
}

// Kamera Modal öffnen (add/rename)
function openCameraModal(camera = null) {
  document.getElementById('modalTitle').textContent = camera ? 'Kamera umbenennen' : 'Kamera hinzufügen';
  document.getElementById('cameraName').value  = camera ? camera.name : '';
  document.getElementById('cameraPhone').value = camera ? camera.phone : '';

  const typeSelect = document.getElementById('cameraType');
  typeSelect.value = camera ? camera.type : '24MP';   // Fallback-Wert
  M.FormSelect.init(typeSelect);

  currentCameraId = camera ? camera.id : null;
  M.Modal.getInstance(document.getElementById('cameraModal')).open();
}

// Kamera speichern
async function saveCamera() {
  const name  = document.getElementById('cameraName').value.trim();
  const phone = document.getElementById('cameraPhone').value.trim();
  if (!name || !phone) return M.toast({ html: 'Bitte alle Felder ausfüllen', classes: 'toast-error' });
  if (!isValidPhoneNumber(phone)) return M.toast({ html: 'Bitte gültige Telefonnummer eingeben', classes: 'toast-error' });

  try {
    const cam = { id: currentCameraId || Date.now().toString(), name, phone, type: document.getElementById('cameraType').value };
    await dbManager.saveCamera(cam);
    if (!currentCameraId) cameras.push(cam);
    else cameras = cameras.map(c => c.id === cam.id ? cam : c);
    M.toast({ html: currentCameraId ? 'Kamera aktualisiert' : 'Kamera hinzugefügt', classes: 'toast-success' });
    M.Modal.getInstance(document.getElementById('cameraModal')).close();
    renderCameraList();
  } catch (err) {
    console.error(err);
    M.toast({ html: 'Fehler beim Speichern', classes: 'toast-error' });
  }
}

// Kameras laden
async function loadCameras() {
  try {
    document.getElementById('loadingIndicator').classList.remove('hide');
    cameras = await dbManager.getAllCameras();
    renderCameraList();
  } catch (err) {
    console.error(err);
    M.toast({ html: 'Fehler beim Laden der Kameras', classes: 'toast-error' });
  } finally {
    document.getElementById('loadingIndicator').classList.add('hide');
  }
}

// Kameras alphabetisch und einzeilig rendern
function renderCameraList() {
  const list = document.getElementById('cameraList'); list.innerHTML = '';
  cameras.sort((a, b) => a.name.localeCompare(b.name)).forEach(addCameraToUI);
  if (!cameras.length) list.innerHTML = `<div class="empty-message">Keine Kameras vorhanden.</div>`;
}

function updateBatchBar() {
  const bar = document.getElementById('batchActionBar');
  const count = selectedIds.size;
  if (count > 0) {
    bar.classList.remove('hide');
    document.getElementById('batchCount').textContent =
      `${count} Kamera${count>1?'s':''} ausgewählt`;
  } else {
    bar.classList.add('hide');
    batchMode = false;
  }
}


function addCameraToUI(camera) {
  const list = document.getElementById('cameraList');
  const item = document.createElement('div'); 
  item.className = 'camera-list-item'; 
  item.dataset.id = camera.id;
  item.dataset.type = camera.type;  // Add the camera type as a data attribute

  item.innerHTML = `
    <div class="camera-list-header">
      <div class="camera-info">
        <h5 class="camera-name">${camera.name}</h5>
      </div>
    </div>
    <div class="camera-actions">
      <i class="material-icons camera-action" data-action="settings">settings</i>
      <i class="material-icons camera-action" data-action="rename">edit</i>
      <i class="material-icons camera-action" data-action="photo">photo</i>
      <i class="material-icons camera-action" data-action="delete">delete</i>
    </div>`;
  
  list.appendChild(item);
  setupCameraActions(item, camera);
  
  item.addEventListener('click', () => {
    // Always allow selection if batch mode is not active
    if (!batchMode) {
      batchMode = true;
    }

    // Get the type of the clicked camera
    const clickedCameraType = item.dataset.type;
    
    // If selectedIds is empty, always allow selection
    if (selectedIds.size === 0) {
      selectCamera(item, camera);
    } else {
      // Check if the clicked camera type matches the first selected camera's type
      const firstSelectedCameraType = 
        document.querySelector(`.camera-list-item[data-id="${Array.from(selectedIds)[0]}"]`).dataset.type;
      
      if (clickedCameraType === firstSelectedCameraType) {
        selectCamera(item, camera);
      } else {
        // Show a toast message about type mismatch
        M.toast({ 
          html: 'Nur Kameras des gleichen Typs können gemeinsam ausgewählt werden', 
          classes: 'toast-error' 
        });
      }
    }
  });
}

function selectCamera(item, camera) {
  batchMode = true;
  item.classList.toggle('selected');
  if (item.classList.contains('selected')) {
    selectedIds.add(camera.id);
  } else {
    selectedIds.delete(camera.id);
  }
  updateBatchBar();
}

// Aktionen für Kamera-Items
function setupCameraActions(item, camera) {
  item.querySelectorAll('.camera-action').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation(); const action = btn.dataset.action;
    if (action==='settings') openSettingsModal(camera);
    if (action==='rename')   openCameraModal(camera);
    if (action==='photo')    requestPhoto(camera);
    if (action==='delete')   deleteCamera(camera);
  }));
}

// Foto anfordern
async function requestPhoto(camera) {
  const smsText = buildSmsCommand('photo');
  const sent = await smsManager.sendSms(camera.phone, smsText, camera.id);
  M.toast({ html: sent?'Foto angefordert':'Fehler', classes: sent?'toast-success':'toast-error' });
}

// Kamera löschen
async function deleteCamera(camera) {
  if (!confirm(`Löschen: ${camera.name}?`)) return;
  await dbManager.deleteCamera(camera.id);
  cameras = cameras.filter(c=>c.id!==camera.id);
  renderCameraList();
  M.toast({ html:'Kamera gelöscht', classes:'toast-success' });
}

// Einstellungen Modal öffnen & befüllen
async function openSettingsModal(camera) {
  currentCameraId = camera.id;
  const settings = await dbManager.getSettings(camera.id) || {};
  initializeSettingsForm();
  Object.entries(settings).forEach(([key,val]) => { const el=document.getElementById(key); if(el){ if(el.type==='checkbox')el.checked=val; else el.value=val; } });
  M.FormSelect.init(document.querySelectorAll('#settingsModal select'));
  M.updateTextFields();
  updateSmsPreview();
  M.Modal.getInstance(document.getElementById('settingsModal')).open();
}

function initializeSettingsForm() {
  // Default-Werte in einem Objekt
  const defaults = {
    smsControl:        'Täglich',
    imageSize:         'HD',
    statusTime:        '00:00',
    statusReportSwitch: true,
    maxCount:          'Kein Limit',
    maxCountSwitch:    false,
    mmsControlSwitch:  false,
    smtpSwitch:        true,
    ftpMode:           'AUS',
    sendImageSwitch:   true,
    sendVideoSwitch:   false,
    captureMode:       'Bild',
    nightMode:         'Balance',
    imageResolution:   '24M',
    videoResolution:   'FHD-1920x1080',
    pirSensitivity:    'Hoch',
    flashLed:          'Hoch',
    videoDuration:     '5s',
    hourSystem:        '24h',
    burstImages:       1,
    motionSensorSwitch:true,
    sdCycleSwitch:     true,
    // Timer-Felder ...
    timer1Start:       '00:00',
    timer1End:         '00:00',
    timer1Switch:      false,
    // ... usw. ...
    phone1:            '',
    email1:            ''
  };

  // Loop über alle Defaults
  Object.entries(defaults).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (!el) return; // wenn Element nicht existiert, skip
    if (el.type === 'checkbox') {
      el.checked = Boolean(value);
    } else {
      el.value = value;
      if (el.tagName === 'SELECT') {
        M.FormSelect.init(el);
      }
    }
  });

  // Range-Slider und Text-Field-Labels noch einmal updaten
  const burst = document.getElementById('burstImages');
  if (burst) {
    document.getElementById('burstImagesValue').textContent = burst.value + 'P';
  }
  M.updateTextFields();
}


// Settings-Formulardaten auslesen (null‑sicher)
function getSettingsFromForm() {
  const form = {};
  const fields = [
    'smsControl',
    'imageSize',
    'statusTime',
    'statusReportSwitch',
    'maxCount',
    'maxCountSwitch',
    'mmsControlSwitch',
    'smtpSwitch',
    'ftpMode',
    'sendImageSwitch',
    'sendVideoSwitch',
    'captureMode',
    'nightMode',
    'imageResolution',
    'videoResolution',
    'pirSensitivity',
    'flashLed',
    'videoDuration',
    'hourSystem',
    'burstImages',
    'motionSensorSwitch',
    'sdCycleSwitch',
    'timer1Switch',
    'timer1Start',
    'timer1End',
    'timer2Switch',
    'timer2Start',
    'timer2End',
    'delaySwitch',
    'delayTime',
    'timelapseSwitch',
    'timelapseTime',
    'phone1',
    'email1'
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;           // existiert nicht → überspringen
    if (el.type === 'checkbox') {
      form[id] = el.checked;
    } else {
      form[id] = el.value;
    }
  });

  return form;
}
function getActiveTab() {
  const tabElement = document.querySelector('.tabs .tab a.active');
  if (!tabElement) return null;
  
  return {
    href: tabElement.getAttribute('href'), // e.g., "#generalSettings"
    text: tabElement.textContent, // e.g., "Allgemein"
    index: Array.from(tabElement.closest('.tabs').querySelectorAll('.tab a')).indexOf(tabElement)
  };
}

// SMS-Vorschau aktualisieren
function updateSmsPreview() {
  const smsPreview = document.getElementById('smsPreviewText');


  const activeTab = getActiveTab();
  // console.log('Active Tab:', activeTab);

  text = ''
  if (activeTab.href == "#generalSettings") {
	text = buildSmsCommand('general');
  } else if (activeTab.href == "#cameraSettings") {
	text = buildSmsCommand('camera');
  } else if (activeTab.href == "#timerSettings") {
	text = buildSmsCommand('camera');
  } else if (activeTab.href == "#recipientSettings") {
	text = buildSmsCommand('email');
  } 


  smsPreview.textContent = text;
}


// Settings senden
async function sendSettings() {

  const camera = cameras.find(c=>c.id===currentCameraId);
  if(!camera) return;
  const settings = getSettingsFromForm();
  await dbManager.saveSettings(camera.id, settings);
  
  const activeTab = getActiveTab();
  // console.log('Active Tab:', activeTab);

  text = ''
  if (activeTab.href == "#generalSettings") {
	text = buildSmsCommand('general');
  } else if (activeTab.href == "#cameraSettings") {
	text = buildSmsCommand('camera');
  } else if (activeTab.href == "#timerSettings") {
	text = buildSmsCommand('camera');
  } else if (activeTab.href == "#recipientSettings") {
	text = buildSmsCommand('email');
  } 
  

  if (sendMultiple==true) {

	// BEGINN Patch hier
	// 1. Sammle alle Nummern der selektierten Kameras
	const phones = Array.from(selectedIds)
	  .map(id => {
		const cam = cameras.find(c => c.id === id);
		return cam && cam.phone;
	  })
	  .filter(Boolean);

	if (phones.length) {
	  // 2. Baue den sms:-Link (iOS/neuere Androids mit Komma getrennt)
	  const recipients = phones.join(',');
	  
	  
	  const smsLink = `sms:${recipients}?body=${encodeURIComponent(text)}`;

	  // 3a. Direkt öffnen:
	  window.location.href = smsLink;

	  // — oder —
	  // 3b. In einen <a id="batchSmsLink"> schreiben:
	  // document.getElementById('batchSmsLink').href = smsLink;
	}
  } else {
	    await smsManager.sendSms(camera.phone, text, camera.id);
  }
  sendMultiple = false


 M.toast({ html:'Einstellungen gesendet', classes:'toast-success' });
  M.Modal.getInstance(document.getElementById('settingsModal')).close();
}

// Hilfsfunktion: Telefonnummer validieren
function isValidPhoneNumber(phoneNumber) {
  return /^\+?[0-9]{8,15}$/.test(phoneNumber);
}

// Netzwerk & Sync Wrapper
async function syncPendingSMS()        { return syncManager.syncPendingSMS(); }
function setupNetworkStatus()          { return syncManager.setupNetworkStatus(); }
