/**
 * sync-manager.js
 * Enthält erweiterte Synchronisationsfunktionen für die App
 */

/**
 * Verbesserte SMS-Synchronisation mit visueller Statusanzeige
 * @returns {Promise<Object>} - Ergebnisobjekt mit Erfolgs- und Fehlerzählern
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
 * Verbesserte Version der Funktion zum Abrufen der ausstehenden SMS-Anzahl
 * Zeigt auch einen Badge-Zähler in der Benutzeroberfläche an
 * @returns {Promise<number>} - Anzahl der ausstehenden SMS
 */
async function checkPendingSMS() {
    try {
        const count = await smsManager.getPendingSmsCount();
        
        // Badge aktualisieren, wenn ausstehende SMS vorhanden sind
        updatePendingSMSBadge(count);
        
        if (count > 0) {
            M.toast({
                html: `Es ${count === 1 ? 'gibt' : 'gibt'} ${count} ausstehende SMS. Synchronisation wird gestartet...`,
                classes: 'toast-info',
                displayLength: 4000
            });
            
            // Falls online, Synchronisation starten
            if (navigator.onLine) {
                syncPendingSMS();
            }
        }
        
        return count;
    } catch (error) {
        console.error('Fehler beim Prüfen auf ausstehende SMS:', error);
        return 0;
    }
}

/**
 * Aktualisiert die Badge-Anzeige für ausstehende SMS in der Benutzeroberfläche
 * @param {number} count - Anzahl der ausstehenden SMS
 */
function updatePendingSMSBadge(count) {
    // Bestehenden Badge suchen oder erstellen
    let badge = document.getElementById('pendingSMSBadge');
    
    if (count > 0) {
        if (!badge) {
            // Badge erstellen, wenn nicht vorhanden
            badge = document.createElement('span');
            badge.id = 'pendingSMSBadge';
            badge.className = 'pending-badge';
            
            // Badge zum Settings-Navigation hinzufügen
            const navSettings = document.getElementById('navSettings');
            if (navSettings) {
                navSettings.appendChild(badge);
            }
        }
        
        // Badge-Text aktualisieren
        badge.textContent = count;
        badge.style.display = 'block';
    } else if (badge) {
        // Badge ausblenden, wenn keine ausstehenden SMS
        badge.style.display = 'none';
    }
}

/**
 * Verbesserte Funktion zum Überwachen des Online/Offline-Status
 * Bietet visuelle Indikatoren und automatische Synchronisation
 */
function setupNetworkStatus() {
    // Statusanzeige erstellen
    const statusIndicator = document.createElement('div');
    statusIndicator.id = 'networkStatusIndicator';
    statusIndicator.className = 'network-status-indicator';
    document.body.appendChild(statusIndicator);
    
    const updateOnlineStatus = () => {
        if (navigator.onLine) {
            console.log('App ist jetzt online');
            document.body.classList.remove('offline');
            statusIndicator.innerHTML = `
                <div class="status-content online">
                    <i class="material-icons">wifi</i>
                    <span>Online</span>
                </div>
            `;
            
            // Nach 3 Sekunden ausblenden
            setTimeout(() => {
                statusIndicator.classList.add('fade-out');
            }, 3000);
            
            M.toast({html: 'Sie sind wieder online! Ausstehende SMS werden jetzt gesendet...', classes: 'toast-success'});
            
            // Versuche, ausstehende SMS zu synchronisieren
            syncPendingSMS();
        } else {
            console.log('App ist jetzt offline');
            document.body.classList.add('offline');
            statusIndicator.innerHTML = `
                <div class="status-content offline">
                    <i class="material-icons">wifi_off</i>
                    <span>Offline</span>
                </div>
            `;
            statusIndicator.classList.remove('fade-out');
            
            M.toast({html: 'Sie sind offline. SMS werden gespeichert und später gesendet.', classes: 'toast-error'});
        }
    };
    
    // Event-Listener registrieren
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Bei Klick auf den Indikator ausblenden
    statusIndicator.addEventListener('click', () => {
        statusIndicator.classList.add('fade-out');
    });
    
    // Initialen Status setzen
    updateOnlineStatus();
}

// Exportiere Funktionen für die Verwendung in app.js
window.syncManager = {
    syncPendingSMS,
    checkPendingSMS,
    setupNetworkStatus
};
