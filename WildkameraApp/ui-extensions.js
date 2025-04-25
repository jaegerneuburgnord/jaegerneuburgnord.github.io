/**
 * ui-extensions.js
 * Enthält erweiterte UI-Funktionalitäten für die Wildkamera-App
 */

// ------ Filtern und Sortieren der Kameraliste ------

/**
 * Richtet die Filter- und Sortierfunktionalität für die Kameraliste ein
 */
function setupCameraListFiltering() {
    // Filter-Bereich zum DOM hinzufügen
    const mainContainer = document.querySelector('.main-container .row');
    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterContainer.innerHTML = `
        <div class="input-field search-field">
            <i class="material-icons prefix">search</i>
            <input type="text" id="cameraSearch" placeholder="Kamera suchen...">
        </div>
        <div class="filter-chips">
            <div class="chip filter-chip active" data-filter="all">Alle</div>
            <div class="chip filter-chip" data-filter="Standard">Standard</div>
            <div class="chip filter-chip" data-filter="Pro">Pro</div>
            <div class="chip filter-chip" data-filter="Max">Max</div>
        </div>
        <div class="sort-control">
            <label>
                <input type="checkbox" id="sortCameras" />
                <span>Alphabetisch sortieren</span>
            </label>
        </div>
    `;
    
    mainContainer.insertBefore(filterContainer, mainContainer.firstChild);
    
    // Event-Listener für die Suche
    const searchInput = document.getElementById('cameraSearch');
    searchInput.addEventListener('input', filterCameraList);
    
    // Event-Listener für Filter-Chips
    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            // Aktiven Filter setzen
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            
            // Kameraliste filtern
            filterCameraList();
        });
    });
    
    // Event-Listener für Sortierung
    const sortCheckbox = document.getElementById('sortCameras');
    sortCheckbox.addEventListener('change', filterCameraList);
}

/**
 * Filtert und sortiert die Kameraliste basierend auf den Filtereinstellungen
 */
function filterCameraList() {
    const searchTerm = document.getElementById('cameraSearch').value.toLowerCase();
    const activeFilter = document.querySelector('.filter-chip.active').getAttribute('data-filter');
    const sortAlphabetically = document.getElementById('sortCameras').checked;
    
    // Alle Kamera-Elemente durchgehen
    const cameraItems = document.querySelectorAll('.camera-list-item');
    
    // Gefilterte und sortierte Kameras
    let filteredCameras = Array.from(cameraItems).filter(item => {
        // Kamera-Details
        const cameraName = item.querySelector('.camera-name').textContent.toLowerCase();
        const cameraType = item.querySelector('.camera-badge').textContent;
        
        // Suchbegriff prüfen
        const matchesSearch = cameraName.includes(searchTerm);
        
        // Typ-Filter prüfen
        const matchesFilter = activeFilter === 'all' || cameraType === activeFilter;
        
        return matchesSearch && matchesFilter;
    });
    
    // Sortieren, falls aktiviert
    if (sortAlphabetically) {
        filteredCameras.sort((a, b) => {
            const nameA = a.querySelector('.camera-name').textContent.toLowerCase();
            const nameB = b.querySelector('.camera-name').textContent.toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }
    
    // Alle ausblenden
    cameraItems.forEach(item => {
        item.style.display = 'none';
    });
    
    // Gefilterte anzeigen und neu anordnen
    const cameraList = document.getElementById('cameraList');
    filteredCameras.forEach(item => {
        item.style.display = 'block';
        cameraList.appendChild(item); // Neu anordnen
    });
    
    // Leere Meldung anzeigen, wenn keine Ergebnisse
    let emptyMessage = document.getElementById('emptyFilterMessage');
    if (filteredCameras.length === 0) {
        if (!emptyMessage) {
            emptyMessage = document.createElement('div');
            emptyMessage.id = 'emptyFilterMessage';
            emptyMessage.className = 'empty-message center-align';
            emptyMessage.innerHTML = `
                <i class="material-icons medium">search_off</i>
                <p>Keine Kameras gefunden.<br>Versuchen Sie andere Filterkriterien.</p>
            `;
            cameraList.appendChild(emptyMessage);
        }
    } else if (emptyMessage) {
        emptyMessage.remove();
    }
}

// ------ Batch-Operationen für mehrere Kameras ------

/**
 * Richtet die Mehrfachauswahl- und Batch-Operationen ein
 */
function setupBatchOperations() {
    // Batch-Aktionsleiste hinzufügen
    const mainContainer = document.querySelector('.main-container');
    const batchActionBar = document.createElement('div');
    batchActionBar.className = 'batch-action-bar hide';
    batchActionBar.innerHTML = `
        <div class="batch-info">
            <i class="material-icons">check_circle</i>
            <span class="selected-count">0 ausgewählt</span>
        </div>
        <div class="batch-actions">
            <button class="batch-action btn-flat waves-effect" data-action="photo">
                <i class="material-icons">photo_camera</i>
                <span>Foto anfordern</span>
            </button>
            <button class="batch-action btn-flat waves-effect" data-action="status">
                <i class="material-icons">info</i>
                <span>Status abfragen</span>
            </button>
            <button class="batch-action btn-flat waves-effect" data-action="cancel">
                <i class="material-icons">close</i>
                <span>Abbrechen</span>
            </button>
        </div>
    `;
    
    mainContainer.appendChild(batchActionBar);
    
    // Checkbox für Mehrfachauswahl zum Header hinzufügen
    const addBatchModeButton = document.createElement('button');
    addBatchModeButton.className = 'btn-floating btn-small waves-effect waves-light batch-mode-toggle';
    addBatchModeButton.innerHTML = '<i class="material-icons">playlist_add_check</i>';
    
    const navWrapper = document.querySelector('.nav-wrapper');
    navWrapper.appendChild(addBatchModeButton);
    
    // Event-Listener für Batch-Modus-Toggle
    addBatchModeButton.addEventListener('click', toggleBatchMode);
    
    // Event-Listener für Batch-Aktionen
    const batchActions = document.querySelectorAll('.batch-action');
    batchActions.forEach(action => {
        action.addEventListener('click', () => {
            const actionType = action.getAttribute('data-action');
            executeBatchAction(actionType);
        });
    });
}

/**
 * Aktiviert oder deaktiviert den Batch-Modus
 */
function toggleBatchMode() {
    // Batch-Modus an der App-Klasse erkennen
    const app = document.body;
    const isBatchMode = app.classList.toggle('batch-mode');
    
    // Batch-Aktionsleiste anzeigen/ausblenden
    const batchActionBar = document.querySelector('.batch-action-bar');
    if (isBatchMode) {
        batchActionBar.classList.remove('hide');
        
        // Checkboxen zu allen Kameraelementen hinzufügen
        const cameraItems = document.querySelectorAll('.camera-list-item');
        cameraItems.forEach(item => {
            // Wenn noch keine Checkbox vorhanden ist
            if (!item.querySelector('.camera-checkbox')) {
                const checkbox = document.createElement('div');
                checkbox.className = 'camera-checkbox';
                checkbox.innerHTML = '<i class="material-icons">check_circle</i>';
                item.appendChild(checkbox);
                
                // Event-Listener für Checkbox
                checkbox.addEventListener('click', (e) => {
                    e.stopPropagation();
                    item.classList.toggle('selected');
                    updateSelectedCount();
                });
            }
        });
    } else {
        batchActionBar.classList.add('hide');
        
        // Ausgewählte Kameras zurücksetzen
        const selectedItems = document.querySelectorAll('.camera-list-item.selected');
        selectedItems.forEach(item => {
            item.classList.remove('selected');
        });
    }
}

/**
 * Aktualisiert die Anzeige der ausgewählten Kameras
 */
function updateSelectedCount() {
    const selectedItems = document.querySelectorAll('.camera-list-item.selected');
    const countElement = document.querySelector('.selected-count');
    
    if (countElement) {
        countElement.textContent = `${selectedItems.length} ausgewählt`;
    }
}

/**
 * Führt eine Aktion für alle ausgewählten Kameras aus
 * @param {string} actionType - Typ der Aktion (photo, status, cancel)
 */
async function executeBatchAction(actionType) {
    const selectedItems = document.querySelectorAll('.camera-list-item.selected');
    
    if (actionType === 'cancel') {
        // Batch-Modus beenden
        toggleBatchMode();
        return;
    }
    
    if (selectedItems.length === 0) {
        M.toast({html: 'Bitte wählen Sie mindestens eine Kamera aus', classes: 'toast-warning'});
        return;
    }
    
    // Bestätigungsdialog anzeigen
    const confirmAction = confirm(`Möchten Sie die Aktion "${actionType}" für ${selectedItems.length} Kamera(s) ausführen?`);
    
    if (!confirmAction) {
        return;
    }
    
    // Ladeanzeige erstellen
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'batch-loading center-align';
    loadingIndicator.innerHTML = `
        <div class="preloader-wrapper small active">
            <div class="spinner-layer spinner-green-only">
                <div class="circle-clipper left"><div class="circle"></div></div>
                <div class="gap-patch"><div class="circle"></div></div>
                <div class="circle-clipper right"><div class="circle"></div></div>
            </div>
        </div>
        <p>Führe Aktion für ${selectedItems.length} Kamera(s) aus...</p>
    `;
    document.body.appendChild(loadingIndicator);
    
    // SMS-Befehl basierend auf Aktionstyp
    const smsCommand = actionType === 'photo' ? 'photo' : 'status';
    
    // Für jede ausgewählte Kamera ausführen
    let successCount = 0;
    let failCount = 0;
    
    for (const item of selectedItems) {
        const cameraId = item.dataset.id;
        const camera = cameras.find(cam => cam.id === cameraId);
        
        if (camera) {
            try {
                const smsText = buildSmsCommand(smsCommand);
                const sent = await smsManager.sendSms(camera.phone, smsText, camera.id);
                
                if (sent || !navigator.onLine) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`Fehler bei Kamera ${camera.name}:`, error);
                failCount++;
            }
        }
    }
    
    // Ladeanzeige entfernen
    loadingIndicator.remove();
    
    // Ergebnis anzeigen
    if (failCount === 0) {
        M.toast({html: `Aktion für ${successCount} Kamera(s) erfolgreich ausgeführt`, classes: 'toast-success'});
    } else {
        M.toast({html: `${successCount} erfolgreich, ${failCount} fehlgeschlagen`, classes: 'toast-warning'});
    }
    
    // Batch-Modus beenden
    toggleBatchMode();
}

// ------ Drag and Drop für Kameraliste ------

/**
 * Richtet Drag-and-Drop-Funktionalität für die Kameraliste ein
 */
function setupDragAndDropSorting() {
    let draggedItem = null;
    let initialOrder = [];
    
    // Event Listener für Kameraliste
    const cameraList = document.getElementById('cameraList');
    
    // MutationObserver, um neu gerenderte Kameraelemente zu beobachten
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                mutation.addedNodes.forEach(node => {
                    if (node.classList && node.classList.contains('camera-list-item')) {
                        makeDraggable(node);
                    }
                });
            }
        });
    });
    
    observer.observe(cameraList, { childList: true });
    
    // Funktion, um ein Element draggable zu machen
    function makeDraggable(element) {
        element.setAttribute('draggable', 'true');
        
        // Drag-Start-Events
        element.addEventListener('dragstart', e => {
            draggedItem = element;
            element.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            // Speichere aktuelle Reihenfolge
            initialOrder = Array.from(document.querySelectorAll('.camera-list-item')).map(item => item.dataset.id);
        });
        
        // Drag-End-Events
        element.addEventListener('dragend', () => {
            element.classList.remove('dragging');
            
            // Speichere neue Reihenfolge
            const newOrder = Array.from(document.querySelectorAll('.camera-list-item')).map(item => item.dataset.id);
            
            // Prüfe, ob sich die Reihenfolge geändert hat
            if (JSON.stringify(initialOrder) !== JSON.stringify(newOrder)) {
                // Speichere neue Reihenfolge in der Datenbank
                saveCameraOrder(newOrder);
            }
        });
        
        // Drag-Over-Events für Drop-Zone
        element.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(cameraList, e.clientY);
            if (afterElement == null) {
                cameraList.appendChild(draggedItem);
            } else {
                cameraList.insertBefore(draggedItem, afterElement);
            }
        });
    }
    
    // Bestimmt, nach welchem Element gedroppt werden soll
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.camera-list-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
    
    // Speichert die neue Kameraanordnung in der Datenbank
    async function saveCameraOrder(newOrder) {
        try {
            // Aktualisiere die cameras-Array mit der neuen Reihenfolge
            cameras = newOrder.map(id => cameras.find(cam => cam.id === id));
            
            // Hier können Sie die neue Reihenfolge in der Datenbank speichern
            // Diese Implementierung hängt von Ihrer spezifischen Datenbankstruktur ab
            
            M.toast({html: 'Kameraanordnung gespeichert', classes: 'toast-success'});
        } catch (error) {
            console.error('Fehler beim Speichern der Kameraanordnung:', error);
            M.toast({html: 'Fehler beim Speichern der Anordnung', classes: 'toast-error'});
            // Bei Fehler die Liste neu rendern
            renderCameraList();
        }
    }
    
    // Bestehende Kameraelemente draggable machen
    document.querySelectorAll('.camera-list-item').forEach(item => {
        makeDraggable(item);
    });
}

// Exportiere Funktionen, um sie in der app.js zu nutzen
window.uiExtensions = {
    setupCameraListFiltering,
    filterCameraList,
    setupBatchOperations,
    setupDragAndDropSorting
};
