/**
 * offline-map-downloader.js
 * Ermöglicht das Vorab-Laden von Kartenbereichen für Offline-Nutzung
 */

class OfflineMapDownloader {
    constructor() {
        this.isDownloading = false;
        this.downloadProgress = 0;
        this.totalTiles = 0;
        this.downloadedTiles = 0;
    }

    /**
     * Berechnet alle Tile-Koordinaten für einen Bereich
     */
    getTileCoordinates(bounds, minZoom, maxZoom) {
        const tiles = [];

        for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
            const topLeft = this.latLngToTile(bounds.getNorth(), bounds.getWest(), zoom);
            const bottomRight = this.latLngToTile(bounds.getSouth(), bounds.getEast(), zoom);

            for (let x = topLeft.x; x <= bottomRight.x; x++) {
                for (let y = topLeft.y; y <= bottomRight.y; y++) {
                    tiles.push({ x, y, z: zoom });
                }
            }
        }

        return tiles;
    }

    /**
     * Konvertiert Lat/Lng zu Tile-Koordinaten
     */
    latLngToTile(lat, lng, zoom) {
        const n = Math.pow(2, zoom);
        const x = Math.floor((lng + 180) / 360 * n);
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
        return { x, y };
    }

    /**
     * Lädt einen Bereich für Offline-Nutzung herunter
     */
    async downloadArea(bounds, layerUrl, minZoom = 12, maxZoom = 16) {
        if (this.isDownloading) {
            console.warn('Download bereits im Gange');
            return;
        }

        this.isDownloading = true;
        this.downloadProgress = 0;
        this.downloadedTiles = 0;

        const tiles = this.getTileCoordinates(bounds, minZoom, maxZoom);
        this.totalTiles = tiles.length;

        console.log(`[OfflineDownloader] Start: ${this.totalTiles} Tiles (Zoom ${minZoom}-${maxZoom})`);

        // Progress-Toast anzeigen
        if (typeof M !== 'undefined') {
            M.toast({
                html: `Download gestartet: ${this.totalTiles} Kacheln (Zoom ${minZoom}-${maxZoom})`,
                displayLength: 3000
            });
        }

        try {
            // Download in Batches um Browser nicht zu überlasten
            const batchSize = 10;
            for (let i = 0; i < tiles.length; i += batchSize) {
                const batch = tiles.slice(i, i + batchSize);
                await Promise.all(batch.map(tile => this.downloadTile(tile, layerUrl)));

                this.downloadProgress = Math.round((i / tiles.length) * 100);

                // Update UI
                this.updateProgress();
            }

            console.log('[OfflineDownloader] Abgeschlossen!');
            if (typeof M !== 'undefined') {
                M.toast({
                    html: `✅ Download abgeschlossen: ${this.downloadedTiles}/${this.totalTiles} Kacheln`,
                    displayLength: 4000,
                    classes: 'green'
                });
            }

        } catch (error) {
            console.error('[OfflineDownloader] Fehler:', error);
            if (typeof M !== 'undefined') {
                M.toast({
                    html: `❌ Download fehlgeschlagen: ${error.message}`,
                    displayLength: 4000,
                    classes: 'red'
                });
            }
        } finally {
            this.isDownloading = false;
            this.downloadProgress = 0;
        }
    }

    /**
     * Lädt ein einzelnes Tile herunter
     */
    async downloadTile(tile, layerUrlTemplate) {
        const url = layerUrlTemplate
            .replace('{z}', tile.z)
            .replace('{x}', tile.x)
            .replace('{y}', tile.y)
            .replace('{s}', 'a'); // Subdomain für OSM

        try {
            const response = await fetch(url);
            if (response.ok) {
                // In Cache speichern
                const cache = await caches.open('wildkamera-tiles-v1.0.1');
                await cache.put(url, response);
                this.downloadedTiles++;
                return true;
            }
        } catch (error) {
            console.warn(`Tile download failed: ${url}`, error);
        }
        return false;
    }

    /**
     * Aktualisiert den Progress
     */
    updateProgress() {
        // Event für UI-Updates
        window.dispatchEvent(new CustomEvent('offline-download-progress', {
            detail: {
                progress: this.downloadProgress,
                downloaded: this.downloadedTiles,
                total: this.totalTiles
            }
        }));

        console.log(`[OfflineDownloader] Progress: ${this.downloadProgress}% (${this.downloadedTiles}/${this.totalTiles})`);
    }

    /**
     * Schätzt die Download-Größe
     */
    estimateDownloadSize(bounds, minZoom, maxZoom) {
        const tiles = this.getTileCoordinates(bounds, minZoom, maxZoom);
        const avgTileSize = 25 * 1024; // ~25KB pro Tile
        const totalSizeMB = (tiles.length * avgTileSize) / (1024 * 1024);

        return {
            tileCount: tiles.length,
            estimatedSizeMB: Math.round(totalSizeMB * 10) / 10
        };
    }

    /**
     * Löscht alle gecachten Tiles
     */
    async clearOfflineMaps() {
        try {
            const deleted = await caches.delete('wildkamera-tiles-v1.0.1');
            if (deleted) {
                console.log('[OfflineDownloader] Offline-Karten gelöscht');
                if (typeof M !== 'undefined') {
                    M.toast({
                        html: '✅ Offline-Karten gelöscht',
                        displayLength: 2000
                    });
                }
            }
        } catch (error) {
            console.error('Fehler beim Löschen:', error);
        }
    }

    /**
     * Zeigt Statistiken über gecachte Tiles
     */
    async getCacheStats() {
        try {
            const cache = await caches.open('wildkamera-tiles-v1.0.1');
            const keys = await cache.keys();

            let totalSize = 0;
            for (const request of keys) {
                const response = await cache.match(request);
                if (response) {
                    const blob = await response.blob();
                    totalSize += blob.size;
                }
            }

            return {
                tileCount: keys.length,
                totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 10) / 10
            };
        } catch (error) {
            console.error('Cache stats error:', error);
            return { tileCount: 0, totalSizeMB: 0 };
        }
    }
}

// Singleton-Instanz
const offlineMapDownloader = new OfflineMapDownloader();
window.offlineMapDownloader = offlineMapDownloader;
