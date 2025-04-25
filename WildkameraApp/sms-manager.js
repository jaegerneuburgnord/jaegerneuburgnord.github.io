/**
 * sms-manager.js
 * Verwaltet das Senden von SMS und die Offline-Funktionalität
 */

class SmsManager {
    constructor() {
        // Referenz zur Datenbank
        this.dbManager = window.dbManager;
    }

    /**
     * Sendet eine SMS an die angegebene Nummer
     * @param {string} phoneNumber - Zieltelefonnummer
     * @param {string} message - SMS-Nachrichtentext
     * @param {string} cameraId - ID der Kamera (für Offline-Speicherung)
     * @returns {Promise<boolean>} - true bei Erfolg, false bei Misserfolg
     */
    async sendSms(phoneNumber, message, cameraId) {
        // Online-Status prüfen
        if (!navigator.onLine) {
            // Wenn offline, SMS zur späteren Verarbeitung speichern
            await this.savePendingSms(phoneNumber, message, cameraId);
            return false;
        }

        try {
            // Versuchen, SMS zu senden
            const success = await this.trySendSms(phoneNumber, message);
            
            if (!success) {
                // Bei Misserfolg trotz Online-Status, in Queue speichern
                await this.savePendingSms(phoneNumber, message, cameraId);
            }
            
            return success;
        } catch (error) {
            console.error('Fehler beim Senden der SMS:', error);
            // Bei Fehler in Queue speichern
            await this.savePendingSms(phoneNumber, message, cameraId);
            return false;
        }
    }

    /**
     * Versucht, eine SMS über verschiedene Methoden zu senden
     * @param {string} phoneNumber - Zieltelefonnummer
     * @param {string} message - SMS-Nachrichtentext
     * @returns {Promise<boolean>} - true bei Erfolg
     */
    async trySendSms(phoneNumber, message) {
        // Versuch 1: Web SMS API verwenden (falls unterstützt)
        if ('sms' in navigator && typeof navigator.sms.send === 'function') {
            try {
                const result = await navigator.sms.send({
                    phoneNumber: phoneNumber,
                    message: message
                });
                
                //M.toast({ html: 'SMS gesendet über: Web SMS API', displayLength: 4000 });

                return result.success;
            } catch (error) {
                console.warn('Web SMS API nicht unterstützt oder Fehler:', error);
                // Fallback auf andere Methoden
            }
        }
        
        // Versuch 2: SMS URL-Schema verwenden
        try {
            // SMS URL-Schema öffnen
            const refText = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;


            const link = document.createElement('a');
            link.href = refText;
            link.target = '_blank';
            link.click();

            //window.location.href = refText;

            // M.toast({ html: 'SMS gesendet über: URL '+refText, displayLength: 4000 });

            // Wir können nicht sicher wissen, ob der Benutzer die SMS tatsächlich gesendet hat,
            // aber wir können annehmen, dass der Versuch erfolgreich war, wenn keine Exception geworfen wurde
            return true;
        } catch (error) {
            console.warn('SMS URL-Schema fehlgeschlagen:', error);
        }

        // Versuch 3: Web Share API verwenden (falls unterstützt)
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'SMS senden',
                    text: message,
                    url: `sms:${phoneNumber}`
                });
                

                // M.toast({ html: 'SMS gesendet WEB API', displayLength: 4000 });

                // Auch hier können wir nicht sicher wissen, ob die SMS gesendet wurde
                return true;
            } catch (error) {
                // Wenn der Benutzer den Dialog abgebrochen hat (AbortError),
                // betrachten wir das nicht als Fehler
                if (error.name !== 'AbortError') {
                    console.warn('Web Share API fehlgeschlagen:', error);
                }
                return false;
            }
        }

        //M.toast({ html: 'SMS gesendet über ---', displayLength: 4000 });

        // Wenn keine Methode funktioniert hat
        console.error('Keine Methode zum Senden von SMS verfügbar');
        return false;
    }

    /**
     * Speichert eine SMS für späteren Versand
     * @param {string} phoneNumber - Zieltelefonnummer
     * @param {string} message - SMS-Nachrichtentext
     * @param {string} cameraId - ID der zugehörigen Kamera
     * @returns {Promise<number>} - ID der gespeicherten SMS
     */
    async savePendingSms(phoneNumber, message, cameraId) {
        const smsData = {
            cameraId: cameraId,
            phoneNumber: phoneNumber,
            message: message,
            timestamp: new Date().toISOString(),
            attempts: 0
        };
        
        try {
            // In IndexedDB speichern
            const smsId = await this.dbManager.savePendingSMS(smsData);
            
            // Background Sync registrieren, falls unterstützt
            this.registerSync();
            
            return smsId;
        } catch (error) {
            console.error('Fehler beim Speichern der ausstehenden SMS:', error);
            throw error;
        }
    }

    /**
     * Registriert einen Background Sync für ausstehende SMS
     */
    async registerSync() {
        if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
                const registration = await navigator.serviceWorker.ready;
                await registration.sync.register('sync-sms');
                console.log('Background Sync für SMS registriert');
            } catch (error) {
                console.error('Fehler bei der Registrierung des Background Sync:', error);
            }
        } else {
            console.warn('Background Sync wird nicht unterstützt');
        }
    }

    /**
     * Versucht, alle ausstehenden SMS zu senden
     * @returns {Promise<Object>} - Objekt mit Erfolgs- und Fehlerzählern
     */
    async syncPendingSms() {
        // Nur fortfahren, wenn online
        if (!navigator.onLine) {
            console.log('Offline - SMS-Synchronisation übersprungen');
            return { success: 0, failed: 0 };
        }
        
        try {
            // Alle ausstehenden SMS abrufen
            const pendingSms = await this.dbManager.getAllPendingSMS();
            
            if (pendingSms.length === 0) {
                console.log('Keine ausstehenden SMS zum Synchronisieren');
                return { success: 0, failed: 0 };
            }
            
            console.log(`Starte Synchronisation von ${pendingSms.length} ausstehenden SMS`);
            
            let successCount = 0;
            let failedCount = 0;
            
            // Versuche, jede SMS zu senden
            for (const sms of pendingSms) {
                try {
                    // Versuche maximal 3 Mal
                    if (sms.attempts >= 3) {
                        console.warn(`SMS mit ID ${sms.id} hat die maximale Anzahl von Versuchen überschritten`);
                        failedCount++;
                        continue;
                    }
                    
                    // Versuch erhöhen
                    sms.attempts++;
                    
                    // SMS senden
                    const success = await this.trySendSms(sms.phoneNumber, sms.message);
                    
                    if (success) {
                        // Bei Erfolg aus der Datenbank entfernen
                        await this.dbManager.deletePendingSMS(sms.id);
                        successCount++;
                    } else {
                        // Bei Misserfolg die aktualisierte SMS speichern
                        await this.dbManager.savePendingSMS(sms);
                        failedCount++;
                    }
                } catch (error) {
                    console.error(`Fehler beim Synchronisieren der SMS mit ID ${sms.id}:`, error);
                    failedCount++;
                }
            }
            
            console.log(`SMS-Synchronisation abgeschlossen: ${successCount} erfolgreich, ${failedCount} fehlgeschlagen`);
            return { success: successCount, failed: failedCount };
        } catch (error) {
            console.error('Fehler bei der SMS-Synchronisation:', error);
            return { success: 0, failed: 0, error };
        }
    }

    /**
     * Prüft die Anzahl der ausstehenden SMS
     * @returns {Promise<number>} - Anzahl der ausstehenden SMS
     */
    async getPendingSmsCount() {
        try {
            const pendingSms = await this.dbManager.getAllPendingSMS();
            return pendingSms.length;
        } catch (error) {
            console.error('Fehler beim Abrufen der ausstehenden SMS-Anzahl:', error);
            return 0;
        }
    }
}

// Singleton-Instanz erstellen
const smsManager = new SmsManager();

// Exportieren, um es in anderen Dateien zu nutzen
window.smsManager = smsManager;
