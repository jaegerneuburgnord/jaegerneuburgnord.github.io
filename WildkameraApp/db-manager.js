/**
 * db-manager.js
 * Verwaltet die IndexedDB für die Offline-Funktionalität
 */

class DatabaseManager {
    constructor() {
        this.DB_NAME = 'wildkamera-db';
        this.DB_VERSION = 1;
        this.CAMERAS_STORE = 'cameras';
        this.SETTINGS_STORE = 'settings';
        this.PENDING_SMS_STORE = 'pending-sms';
        this.db = null;
    }

    /**
     * Öffnet die Datenbank und erstellt die nötigen Object Stores
     * @returns {Promise<IDBDatabase>} - Datenbankinstanz
     */
    async openDatabase() {
        if (this.db) {
            return Promise.resolve(this.db);
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            // Bei Datenbank-Upgrade oder initialer Erstellung
            request.onupgradeneeded = (event) => {
                console.log(`Datenbank wird erstellt/aktualisiert auf Version ${this.DB_VERSION}`);
                const db = event.target.result;

                // Kamera-Store erstellen (wenn nicht vorhanden)
                if (!db.objectStoreNames.contains(this.CAMERAS_STORE)) {
                    const cameraStore = db.createObjectStore(this.CAMERAS_STORE, { keyPath: 'id' });
                    cameraStore.createIndex('name', 'name', { unique: false });
                    cameraStore.createIndex('phone', 'phone', { unique: true });
                    console.log(`Object Store '${this.CAMERAS_STORE}' wurde erstellt`);
                }

                // Einstellungs-Store erstellen (wenn nicht vorhanden)
                if (!db.objectStoreNames.contains(this.SETTINGS_STORE)) {
                    const settingsStore = db.createObjectStore(this.SETTINGS_STORE, { keyPath: 'cameraId' });
                    console.log(`Object Store '${this.SETTINGS_STORE}' wurde erstellt`);
                }

                // Pending SMS Store erstellen (wenn nicht vorhanden)
                if (!db.objectStoreNames.contains(this.PENDING_SMS_STORE)) {
                    const pendingSmsStore = db.createObjectStore(this.PENDING_SMS_STORE, { keyPath: 'id', autoIncrement: true });
                    pendingSmsStore.createIndex('cameraId', 'cameraId', { unique: false });
                    pendingSmsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log(`Object Store '${this.PENDING_SMS_STORE}' wurde erstellt`);
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('Datenbank erfolgreich geöffnet');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('Fehler beim Öffnen der Datenbank:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Speichert eine Kamera in der Datenbank
     * @param {Object} camera - Kamera-Objekt zum Speichern
     * @returns {Promise<string>} - ID der gespeicherten Kamera
     */
    async saveCamera(camera) {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.CAMERAS_STORE], 'readwrite');
            const store = transaction.objectStore(this.CAMERAS_STORE);

            // Wenn keine ID vorhanden, generiere eine
            if (!camera.id) {
                camera.id = Date.now().toString();
            }

            // Zeitstempel hinzufügen
            camera.lastUpdated = new Date().toISOString();

            const request = store.put(camera);

            request.onsuccess = () => {
                console.log(`Kamera ${camera.name} gespeichert mit ID ${camera.id}`);
                resolve(camera.id);
            };

            request.onerror = (event) => {
                console.error('Fehler beim Speichern der Kamera:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Holt alle Kameras aus der Datenbank
     * @returns {Promise<Array>} - Array mit Kamera-Objekten
     */
    async getAllCameras() {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.CAMERAS_STORE], 'readonly');
            const store = transaction.objectStore(this.CAMERAS_STORE);
            const request = store.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result || []);
            };

            request.onerror = (event) => {
                console.error('Fehler beim Abrufen der Kameras:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Holt eine Kamera anhand ihrer ID
     * @param {string} cameraId - ID der Kamera
     * @returns {Promise<Object>} - Kamera-Objekt
     */
    async getCameraById(cameraId) {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.CAMERAS_STORE], 'readonly');
            const store = transaction.objectStore(this.CAMERAS_STORE);
            const request = store.get(cameraId);

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error(`Fehler beim Abrufen der Kamera mit ID ${cameraId}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Löscht eine Kamera anhand ihrer ID
     * @param {string} cameraId - ID der zu löschenden Kamera
     * @returns {Promise<boolean>} - true bei Erfolg
     */
    async deleteCamera(cameraId) {
        const db = await this.openDatabase();

        // Lösche die Kamera aus dem Kamera-Store
        const cameraDeleted = await new Promise((resolve, reject) => {
            const transaction = db.transaction([this.CAMERAS_STORE], 'readwrite');
            const store = transaction.objectStore(this.CAMERAS_STORE);
            const request = store.delete(cameraId);

            request.onsuccess = () => {
                console.log(`Kamera mit ID ${cameraId} wurde gelöscht`);
                resolve(true);
            };

            request.onerror = (event) => {
                console.error(`Fehler beim Löschen der Kamera mit ID ${cameraId}:`, event.target.error);
                reject(event.target.error);
            };
        });

        // Lösche auch die zugehörigen Einstellungen
        if (cameraDeleted) {
            const settingsDeleted = await new Promise((resolve, reject) => {
                const transaction = db.transaction([this.SETTINGS_STORE], 'readwrite');
                const store = transaction.objectStore(this.SETTINGS_STORE);
                const request = store.delete(cameraId);

                request.onsuccess = () => {
                    console.log(`Einstellungen für Kamera mit ID ${cameraId} wurden gelöscht`);
                    resolve(true);
                };

                request.onerror = (event) => {
                    console.error(`Fehler beim Löschen der Einstellungen für Kamera mit ID ${cameraId}:`, event.target.error);
                    // Kein Reject, da es OK ist, wenn keine Einstellungen vorhanden waren
                    resolve(false);
                };
            });
        }

        return cameraDeleted;
    }

    /**
     * Speichert Einstellungen für eine Kamera
     * @param {string} cameraId - ID der Kamera
     * @param {Object} settings - Einstellungsobjekt
     * @returns {Promise<boolean>} - true bei Erfolg
     */
    async saveSettings(cameraId, settings) {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.SETTINGS_STORE], 'readwrite');
            const store = transaction.objectStore(this.SETTINGS_STORE);

            // Zeitstempel hinzufügen
            settings.lastUpdated = new Date().toISOString();
            
            // Einstellungsobjekt vorbereiten
            const settingsEntry = {
                cameraId: cameraId,
                settings: settings
            };

            const request = store.put(settingsEntry);

            request.onsuccess = () => {
                console.log(`Einstellungen für Kamera ${cameraId} gespeichert`);
                resolve(true);
            };

            request.onerror = (event) => {
                console.error('Fehler beim Speichern der Einstellungen:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Holt Einstellungen für eine Kamera
     * @param {string} cameraId - ID der Kamera
     * @returns {Promise<Object>} - Einstellungsobjekt
     */
    async getSettings(cameraId) {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.SETTINGS_STORE], 'readonly');
            const store = transaction.objectStore(this.SETTINGS_STORE);
            const request = store.get(cameraId);

            request.onsuccess = (event) => {
                const result = event.target.result;
                // Wenn Einstellungen vorhanden sind, gib nur das settings-Objekt zurück
                resolve(result ? result.settings : null);
            };

            request.onerror = (event) => {
                console.error(`Fehler beim Abrufen der Einstellungen für Kamera ${cameraId}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Speichert eine ausstehende SMS in der Datenbank
     * @param {Object} smsData - SMS-Daten (cameraId, phoneNumber, message, etc.)
     * @returns {Promise<number>} - ID der gespeicherten SMS
     */
    async savePendingSMS(smsData) {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.PENDING_SMS_STORE], 'readwrite');
            const store = transaction.objectStore(this.PENDING_SMS_STORE);

            // Zeitstempel hinzufügen, falls nicht vorhanden
            if (!smsData.timestamp) {
                smsData.timestamp = new Date().toISOString();
            }

            const request = store.add(smsData);

            request.onsuccess = (event) => {
                console.log(`Ausstehende SMS für Kamera ${smsData.cameraId} gespeichert mit ID ${event.target.result}`);
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error('Fehler beim Speichern der ausstehenden SMS:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Holt alle ausstehenden SMS
     * @returns {Promise<Array>} - Array mit SMS-Objekten
     */
    async getAllPendingSMS() {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.PENDING_SMS_STORE], 'readonly');
            const store = transaction.objectStore(this.PENDING_SMS_STORE);
            const request = store.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result || []);
            };

            request.onerror = (event) => {
                console.error('Fehler beim Abrufen der ausstehenden SMS:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Löscht eine ausstehende SMS anhand ihrer ID
     * @param {number} smsId - ID der zu löschenden SMS
     * @returns {Promise<boolean>} - true bei Erfolg
     */
    async deletePendingSMS(smsId) {
        const db = await this.openDatabase();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([this.PENDING_SMS_STORE], 'readwrite');
            const store = transaction.objectStore(this.PENDING_SMS_STORE);
            const request = store.delete(smsId);

            request.onsuccess = () => {
                console.log(`Ausstehende SMS mit ID ${smsId} wurde gelöscht`);
                resolve(true);
            };

            request.onerror = (event) => {
                console.error(`Fehler beim Löschen der ausstehenden SMS mit ID ${smsId}:`, event.target.error);
                reject(event.target.error);
            };
        });
    }
}

// Singleton-Instanz erstellen
const dbManager = new DatabaseManager();

// Exportieren, um es in anderen Dateien zu nutzen
window.dbManager = dbManager;
