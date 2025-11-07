/**
 * api-client.js
 * API-Client für die Kommunikation mit dem SMS-Server
 */

class ApiClient {
    constructor() {
        // Server-URL aus localStorage oder Standard
        this.serverUrl = localStorage.getItem('smsServerUrl') || 'http://localhost:8000';
        this.timeout = 30000; // 30 Sekunden Timeout
    }

    /**
     * Setzt die Server-URL
     * @param {string} url - Server-URL
     */
    setServerUrl(url) {
        // Entferne trailing slash
        this.serverUrl = url.replace(/\/$/, '');
        localStorage.setItem('smsServerUrl', this.serverUrl);
    }

    /**
     * Holt die aktuelle Server-URL
     * @returns {string} - Server-URL
     */
    getServerUrl() {
        return this.serverUrl;
    }

    /**
     * Führt einen API-Request aus
     * @param {string} endpoint - API-Endpoint (z.B. '/sms/send')
     * @param {Object} options - Fetch-Optionen
     * @returns {Promise<Object>} - Response-Daten
     */
    async request(endpoint, options = {}) {
        const url = `${this.serverUrl}${endpoint}`;

        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: this.timeout
        };

        const mergedOptions = { ...defaultOptions, ...options };

        // Timeout-Implementierung
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...mergedOptions,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('Request timeout - Server antwortet nicht');
            }

            throw error;
        }
    }

    /**
     * Testet die Verbindung zum Server
     * @returns {Promise<boolean>} - true wenn Server erreichbar
     */
    async testConnection() {
        try {
            const response = await this.request('/status');
            return response.status === 'online';
        } catch (error) {
            console.error('Server nicht erreichbar:', error);
            return false;
        }
    }

    /**
     * Sendet eine SMS über den Server
     * @param {string} phoneNumber - Telefonnummer
     * @param {string} message - SMS-Text
     * @param {string} cameraId - Kamera-ID
     * @returns {Promise<Object>} - Response mit success-Status
     */
    async sendSms(phoneNumber, message, cameraId) {
        try {
            const response = await this.request('/sms/send', {
                method: 'POST',
                body: JSON.stringify({
                    phone_number: phoneNumber,
                    message: message,
                    camera_id: cameraId
                })
            });

            return response;
        } catch (error) {
            console.error('Fehler beim Senden der SMS:', error);
            throw error;
        }
    }

    /**
     * Holt den Server-Status
     * @returns {Promise<Object>} - Status-Informationen
     */
    async getStatus() {
        return await this.request('/status');
    }

    /**
     * Speichert Einstellungen auf dem Server
     * @param {string} cameraId - Kamera-ID
     * @param {Object} settings - Einstellungen
     * @returns {Promise<Object>} - Response
     */
    async saveSettings(cameraId, settings) {
        return await this.request('/settings/save', {
            method: 'POST',
            body: JSON.stringify({
                camera_id: cameraId,
                settings: settings
            })
        });
    }

    /**
     * Holt die letzten Einstellungen vom Server
     * @returns {Promise<Object>} - Einstellungen
     */
    async getLastSettings() {
        return await this.request('/settings/last');
    }

    /**
     * Holt Einstellungen für eine bestimmte Kamera
     * @param {string} cameraId - Kamera-ID
     * @returns {Promise<Object>} - Einstellungen
     */
    async getCameraSettings(cameraId) {
        return await this.request(`/settings/camera/${cameraId}`);
    }

    /**
     * Lädt eine KML-Datei auf den Server hoch
     * @param {File} file - KML-Datei
     * @param {string} name - Optionaler Name
     * @returns {Promise<Object>} - Response mit KML-Inhalt
     */
    async uploadKml(file, name = null) {
        const formData = new FormData();
        formData.append('file', file);
        if (name) {
            formData.append('name', name);
        }

        const url = `${this.serverUrl}/kml/upload`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                body: formData
                // Content-Type wird automatisch gesetzt
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Fehler beim Hochladen der KML-Datei:', error);
            throw error;
        }
    }

    /**
     * Listet alle KML-Dateien auf
     * @returns {Promise<Object>} - Liste der KML-Dateien
     */
    async listKmlFiles() {
        return await this.request('/kml/list');
    }

    /**
     * Lädt eine KML-Datei vom Server herunter
     * @param {string} filename - Dateiname
     * @returns {Promise<Object>} - KML-Inhalt
     */
    async downloadKml(filename) {
        return await this.request(`/kml/download/${filename}`);
    }

    /**
     * Löscht eine KML-Datei vom Server
     * @param {string} filename - Dateiname
     * @returns {Promise<Object>} - Response
     */
    async deleteKml(filename) {
        return await this.request(`/kml/delete/${filename}`, {
            method: 'DELETE'
        });
    }

    /**
     * Archiviert eine KML-Datei (rename zu .old statt löschen)
     * @param {string} filename - Dateiname (z.B. "20241107_123456_abcd1234_myfile.kml")
     * @returns {Promise<Object>} - Response mit archivedFilename
     */
    async archiveKml(filename) {
        return await this.request(`/kml/archive/${encodeURIComponent(filename)}`, {
            method: 'POST'
        });
    }

    /**
     * Holt das SMS-Log vom Server
     * @param {number} limit - Maximale Anzahl Einträge
     * @returns {Promise<Object>} - Log-Einträge
     */
    async getSmsLog(limit = 50) {
        return await this.request(`/settings/sms-log?limit=${limit}`);
    }

    /**
     * Konfiguriert das Modem
     * @param {Object} config - Modem-Konfiguration
     * @returns {Promise<Object>} - Response
     */
    async configureModem(config) {
        return await this.request('/modem/configure', {
            method: 'POST',
            body: JSON.stringify(config)
        });
    }

    /**
     * Listet verfügbare serielle Ports auf
     * @returns {Promise<Object>} - Liste der Ports
     */
    async listPorts() {
        return await this.request('/modem/ports');
    }
}

// Singleton-Instanz erstellen
const apiClient = new ApiClient();

// Exportieren
window.apiClient = apiClient;
