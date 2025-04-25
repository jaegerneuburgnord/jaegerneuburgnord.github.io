/**
 * offline-sync.js
 * Verbesserte Offline-Funktionalität und Synchronisation
 */

/**
 * Verbesserte SMS-Synchronisation mit Statusanzeige
 */
async function syncPendingSMS() {
    // Sync-Indikator erstellen/abrufen
    let syncIndicator = document.getElementById('syncIndicator');
    if (!syncIndicator) {
        syncIndicator = document.createElement('div');
        syncIndicator.id = 'syncIndicator';
        syncIndicator.className = 'sync-indicator';
        document.body.appendChild(syncIndicator);
    }
    
    try {
        // Anzahl der ausstehenden SMS abrufen
        const pendingSmsCount = await smsManager.getPendingSmsCount();
        
        if (pendingSmsCount === 0) {
            // Wenn keine ausstehenden SMS vorhanden sind
            syncIndicator.classList.remove('syncing');
            syncIndicator.classList.add('hide');
            return { success: 0, failed: 0 };
        }
        
        // Sync-Indikator anzeigen
        syncIndicator.classList.remove('hide');
        syncIndicator.classList.add('syncing');
        syncIndicator.innerHTML = `
            <div class="sync-content">
                <i class="material-icons">sync</i>
                <span>Synchronisiere ${pendingSmsCount} SMS...</span>
            </div>
        `;
        
        // Versuchen zu synchronisieren
        const result = await smsManager.syncPendingSms();
        
        // Ergebnis anzeigen
        if (result.success > 0 || result.failed > 0) {
            syncIndicator.classList.remove('syncing');
            
            if (result.failed === 0) {
                // Alle erfolgreich
                syncIndicator.innerHTML = `
                    <div class="sync-content success">
                        <i class="material-icons">check_circle</i>
                        <span>${result.success} SMS synchronisiert</span>
                    </div>
                `;
                
                // Nach 3 Sekunden ausblenden
                setTimeout(() => {
                    syncIndicator.classList.add('hide');
                }, 3000);
            } else {
                // Einige fehlgeschlagen
                syncIndicator.innerHTML = `
                    <div class="sync-content warning">
                        <i class="material-icons">warning</i>
                        <span>${result.success} gesendet, ${result.failed} fehlgeschlagen</span>
                        <button class="btn-flat retry-btn">Wiederholen</button>
                    </div>
                `;
                
                // Wiederholen-Button
                const retryBtn = syncIndicator.querySelector('.retry-btn');
                retryBtn.addEventListener('click', () => {
                    syncPendingSMS();
                });
            }
        }
        
        return result;
    } catch (error) {
        console.error('Fehler bei der SMS-Synchronisation:', error);
        
        // Fehler anzeigen
        syncIndicator.classList.remove('syncing');
        syncIndicator.innerHTML = `
            <div class="sync-content error">
                <i class="material-icons">error</i>
                <span>Synchronisation fehlgeschlagen</span>
                <button class="btn-flat retry-btn">Wiederholen</button>
            </div>
        `;
        
        // Wiederholen-Button
        const retryBtn = syncIndicator.querySelector('.retry-btn');
        retryBtn.addEventListener('click', () => {
            syncPendingSMS();
        });
        
        return { success: 0, failed: 0, error };
    }
}

/**
 * Verbesserte Überwachung des Online/Offline-Status mit visueller Rückmeldung
 */
function setupNetworkStatus() {
    // Statusanzeige erstellen
    const statusIndicator = document.createElement('div');
    statusIndicator.className = 'network-status-indicator hide';
    document.body.appendChild(statusIndicator);
    
    const updateOnlineStatus = () => {
        if (navigator.onLine) {
            console.log('App ist jetzt online');
            document.body.classList.remove('offline');
            
            // Online-Status anzeigen
            statusIndicator.innerHTML = `
                <i class="material-icons">wifi</i>
                <span>Online</span>
            `;
            statusIndicator.classList.remove('hide', 'offline');
            statusIndicator.classList.add('online');
            
            // Nach 3 Sekunden ausblenden
            setTimeout(() => {
                statusIndicator.classList.add('hide');
            }, 3000);
            
            // Ausstehende SMS synchronisieren
            syncPendingSMS();
        } else {
            console.log('App ist jetzt offline');
            document.body.classList.add('offline');
            
            // Offline-Status anzeigen
            statusIndicator.innerHTML = `
                <i class="material-icons">wifi_off</i>
                <span>Offline - SMS werden gespeichert</span>
            `;
            statusIndicator.classList.remove('hide', 'online');
            statusIndicator.classList.add('offline');
            
            // Status bleibt sichtbar, solange offline
        }
    };
    
    // Event-Listener für Online/Offline-Status
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initialen Status setzen
    updateOnlineStatus();
}

/**
 * Verbesserte Funktion zum Abrufen und Anzeigen von ausstehenden SMS
 */
async function checkPendingSMS() {
    try {
        const count = await smsManager.getPendingSmsCount();
        
        if (count > 0) {
            // Statusanzeige aktualisieren
            const statusEl = document.getElementById('pendingSmsStatus') || document.createElement('div');
            statusEl.id = 'pendingSmsStatus';
            statusEl.className = 'pending-sms-badge';
            statusEl.innerHTML = `
                <span class="badge">${count}</span>
                <div class="pending-sms-tooltip">
                    ${count} ausstehende SMS
                    <button class="sync-now-btn">Jetzt synchronisieren</button>
                </div>
            `;
            
            // Badge zur Navigationsleiste hinzufügen
            const navItem = document.querySelector('#navSettings');
            if (!document.getElementById('pendingSmsStatus')) {
                navItem.appendChild(statusEl);
                
                // Event-Listener für Sync-Button
                const syncButton = statusEl.querySelector('.sync-now-btn');
                syncButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    syncPendingSMS();
                });
            }
            
            // Falls online, Synchronisation starten
            if (navigator.onLine) {
                syncPendingSMS();
            }
        } else {
            // Badge entfernen, wenn keine ausstehenden SMS
            const statusEl = document.getElementById('pendingSmsStatus');
            if (statusEl) {
                statusEl.remove();
            }
        }
    } catch (error) {
        console.error('Fehler beim Prüfen auf ausstehende SMS:', error);
    }
}

/**
 * Zeigt eine detaillierte Liste aller ausstehenden SMS an
 */
async function showPendingSMSList() {
    try {
        const pendingSMS = await dbManager.getAllPendingSMS();
        
        if (pendingSMS.length === 0) {
            M.toast({html: 'Keine ausstehenden SMS vorhanden', classes: 'toast-info'});
            return;
        }
        
        // Modal erstellen oder abrufen
        let modalEl = document.getElementById('pendingSmsModal');
        
        if (!modalEl) {
            modalEl = document.createElement('div');
            modalEl.id = 'pendingSmsModal';
            modalEl.className = 'modal';
            document.body.appendChild(modalEl);
        }
        
        // Gruppiere SMS nach Kamera
        const smsByCamera = {};
        
        for (const sms of pendingSMS) {
            if (!smsByCamera[sms.cameraId]) {
                // Kamera-Informationen abrufen
                const camera = cameras.find(cam => cam.id === sms.cameraId) || { name: 'Unbekannte Kamera', phone: sms.phoneNumber };
                
                smsByCamera[sms.cameraId] = {
                    camera: camera,
                    messages: []
                };
            }
            
            // SMS zur Gruppe hinzufügen
            smsByCamera[sms.cameraId].messages.push(sms);
        }
        
        // Modal-Inhalt erstellen
        let content = `
            <div class="modal-content">
                <h4>Ausstehende SMS (${pendingSMS.length})</h4>
                <p>Diese SMS werden gesendet, sobald Sie wieder online sind.</p>
                
                <ul class="collapsible pending-sms-list">
        `;
        
        // Für jede Kamera eine Gruppe erstellen
        for (const cameraId in smsByCamera) {
            const group = smsByCamera[cameraId];
            const camera = group.camera;
            const messages = group.messages;
            
            content += `
                <li>
                    <div class="collapsible-header">
                        <i class="material-icons">photo_camera</i>
                        <span>${camera.name}</span>
                        <span class="badge">${messages.length} SMS</span>
                    </div>
                    <div class="collapsible-body">
                        <table class="striped">
                            <thead>
                                <tr>
                                    <th>Zeitpunkt</th>
                                    <th>Inhalt</th>
                                    <th>Versuche</th>
                                    <th>Aktion</th>
                                </tr>
                            </thead>
                            <tbody>
            `;
            
            // SMS-Details für diese Kamera
            for (const sms of messages) {
                const timestamp = new Date(sms.timestamp).toLocaleString();
                const truncatedMessage = sms.message.length > 40 ? sms.message.substring(0, 37) + '...' : sms.message;
                
                content += `
                    <tr data-sms-id="${sms.id}">
                        <td>${timestamp}</td>
                        <td title="${sms.message}">${truncatedMessage}</td>
                        <td>${sms.attempts}</td>
                        <td>
                            <button class="btn-small waves-effect waves-light delete-sms-btn" data-sms-id="${sms.id}">
                                <i class="material-icons">delete</i>
                            </button>
                        </td>
                    </tr>
                `;
            }
            
            content += `
                            </tbody>
                        </table>
                    </div>
                </li>
            `;
        }
        
        content += `
                </ul>
            </div>
            <div class="modal-footer">
                <button class="btn-flat waves-effect modal-close">Schließen</button>
                <button class="btn waves-effect waves-light sync-all-btn">Alle synchronisieren</button>
            </div>
        `;
        
        // Modal aktualisieren und öffnen
        modalEl.innerHTML = content;
        
        // Modal initialisieren
        const modalInstance = M.Modal.init(modalEl);
        
        // Collapsible initialisieren
        M.Collapsible.init(document.querySelectorAll('.collapsible'));
        
        // Event-Listener für "Alle synchronisieren"-Button
        modalEl.querySelector('.sync-all-btn').addEventListener('click', () => {
            syncPendingSMS();
            modalInstance.close();
        });
        
        // Event-Listener für Löschen-Buttons
        const deleteButtons = modalEl.querySelectorAll('.delete-sms-btn');
        deleteButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const smsId = parseInt(btn.getAttribute('data-sms-id'));
                
                if (confirm('Möchten Sie diese ausstehende SMS wirklich löschen?')) {
                    try {
                        await dbManager.deletePendingSMS(smsId);
                        
                        // Zeile aus der Tabelle entfernen
                        const row = modalEl.querySelector(`tr[data-sms-id="${smsId}"]`);
                        if (row) {
                            row.remove();
                        }
                        
                        // Anzahl aktualisieren
                        const pendingCount = await smsManager.getPendingSmsCount();
                        if (pendingCount === 0) {
                            modalInstance.close();
                            checkPendingSMS(); // Badge aktualisieren
                        }
                        
                        M.toast({html: 'SMS gelöscht', classes: 'toast-success'});
                    } catch (error) {
                        console.error('Fehler beim Löschen der SMS:', error);
                        M.toast({html: 'Fehler beim Löschen der SMS', classes: 'toast-error'});
                    }
                }
            });
        });
        
        // Modal öffnen
        modalInstance.open();
    } catch (error) {
        console.error('Fehler beim Abrufen der ausstehenden SMS:', error);
        M.toast({html: 'Fehler beim Abrufen der ausstehenden SMS', classes: 'toast-error'});
    }
}

// Exportiere Funktionen, um sie in der app.js zu nutzen
window.offlineSync = {
    syncPendingSMS,
    setupNetworkStatus,
    checkPendingSMS,
    showPendingSMSList
};
