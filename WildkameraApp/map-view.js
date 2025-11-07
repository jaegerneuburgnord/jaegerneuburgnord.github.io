/**
 * map-view.js
 * Kartendarstellung für Reviergrenzen mit Offline-Unterstützung
 * Erweitert mit WiesenApp-Features: Layer-Management, Suche, Location-Tracking
 */

class MapView {
    constructor() {
        this.map = null;
        this.kmlManager = window.kmlManager;
        this.boundaryLayers = {};  // Changed to object for named layers
        this.markersLayer = null;
        this.searchIndex = [];
        this.userMarker = null;
        this.accuracyCircle = null;
        this.watchId = null;
        this.isLocating = false;
        this.cameraMarkers = {};
        this.baseLayers = {};  // Verschiedene Karten-Layer
        this.currentLayer = null;  // Aktuell aktiver Layer
        this.styleUrlColorMap = {};  // Maps styleUrl zu Farbe (für konsistente Farbzuweisung)
    }

    /**
     * Initialisiert die Karte
     * @param {string} containerId - ID des Container-Elements
     * @param {Object} options - Karten-Optionen
     */
    initMap(containerId, options = {}) {
        const defaultOptions = {
            center: [51.1657, 10.4515], // Deutschland Zentrum
            zoom: 6,
            maxZoom: 18
        };

        const mapOptions = { ...defaultOptions, ...options };

        // Leaflet-Karte erstellen
        this.map = L.map(containerId, { zoomControl: false }).setView(mapOptions.center, mapOptions.zoom);

        // Zoom Control rechts positionieren
        L.control.zoom({ position: 'topright' }).addTo(this.map);

        // Verschiedene Karten-Layer definieren
        this.baseLayers = {
            'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }),
            'Google Satellite': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
                attribution: '© Google',
                maxZoom: 20
            }),
            'Google Hybrid': L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
                attribution: '© Google',
                maxZoom: 20
            }),
            'Esri Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri, Maxar, Earthstar Geographics',
                maxZoom: 19
            }),
            'OpenTopoMap': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap (CC-BY-SA)',
                maxZoom: 17
            })
        };

        // Standard-Layer hinzufügen (OpenStreetMap)
        const savedLayer = localStorage.getItem('selectedMapLayer') || 'OpenStreetMap';
        this.currentLayer = this.baseLayers[savedLayer] || this.baseLayers['OpenStreetMap'];
        this.currentLayer.addTo(this.map);

        // Layer für Marker
        this.markersLayer = L.layerGroup().addTo(this.map);

        // Event-Listener für Karten-Clicks
        this.map.on('click', (e) => {
            console.log(`Koordinaten: ${e.latlng.lat}, ${e.latlng.lng}`);
        });

        // Initialize control panel
        this.initControlPanel();

        return this.map;
    }

    /**
     * Initialisiert das Control-Panel
     */
    initControlPanel() {
        // Check if control panel already exists
        if (document.getElementById('map-control-panel')) {
            return;
        }

        const controlPanel = document.createElement('div');
        controlPanel.id = 'map-control-panel';
        controlPanel.className = 'map-control-panel';
        controlPanel.innerHTML = `
            <div class="map-control-header">
                <span>Karteneinstellungen</span>
                <i class="material-icons toggle-icon">expand_more</i>
            </div>
            <div class="map-control-content">
                <div class="map-layer-section">
                    <div class="map-section-header">
                        <span>Karten-Ansicht</span>
                        <i class="material-icons">expand_less</i>
                    </div>
                    <div class="map-layer-items" id="mapLayerSelector"></div>
                </div>

                <div class="map-button-container">
                    <button class="btn-small waves-effect waves-light" id="uploadKmlBtn">
                        <i class="material-icons left">upload_file</i>KML Upload
                    </button>
                    <button class="btn-small waves-effect waves-light green" id="toggleLocationBtn">
                        <i class="material-icons left">my_location</i>Position
                    </button>
                </div>

                <div class="map-button-container">
                    <button class="btn-small waves-effect waves-light" id="syncKmlBtn">
                        <i class="material-icons left">sync</i>Sync
                    </button>
                    <button class="btn-small waves-effect waves-light purple" id="toggleLabelsBtn" title="Labels ein-/ausblenden">
                        <i class="material-icons left">label</i>Labels
                    </button>
                </div>

                <div class="map-button-container">
                    <button class="btn-small waves-effect waves-light green" id="fullscreenBtn">
                        <i class="material-icons left">fullscreen</i>Vollbild
                    </button>
                    <button class="btn-small waves-effect waves-light blue" id="downloadOfflineBtn">
                        <i class="material-icons left">cloud_download</i>Offline
                    </button>
                </div>

                <div class="map-layer-section">
                    <div class="map-section-header">
                        <span>Hochgeladene KML-Dateien</span>
                        <i class="material-icons">expand_less</i>
                    </div>
                    <div class="map-layer-items" id="uploadedKmlList">
                        <div style="padding: 10px; color: #999; font-size: 12px; text-align: center;">
                            Keine hochgeladenen Dateien
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(controlPanel);

        // Toggle panel
        const header = controlPanel.querySelector('.map-control-header');
        const content = controlPanel.querySelector('.map-control-content');
        const toggleIcon = header.querySelector('.toggle-icon');

        header.addEventListener('click', () => {
            content.classList.toggle('collapsed');
            toggleIcon.textContent = content.classList.contains('collapsed') ?
                'expand_less' : 'expand_more';
        });

        // Section toggles
        const sectionHeaders = controlPanel.querySelectorAll('.map-section-header');
        sectionHeaders.forEach(header => {
            const icon = header.querySelector('i');
            const content = header.nextElementSibling;

            header.addEventListener('click', () => {
                content.classList.toggle('collapsed');
                icon.textContent = content.classList.contains('collapsed') ?
                    'expand_more' : 'expand_less';
            });
        });

        // Layer-Selector befüllen
        this.populateLayerSelector();

        // Uploaded KML List befüllen
        this.populateUploadedKmlList();

        // Location button
        const locationBtn = document.getElementById('toggleLocationBtn');
        locationBtn.addEventListener('click', () => {
            this.toggleLocationTracking();
        });

        // KML Upload button
        const uploadKmlBtn = document.getElementById('uploadKmlBtn');
        const kmlFileInput = document.getElementById('kmlFileInput');
        uploadKmlBtn?.addEventListener('click', () => {
            kmlFileInput?.click();
        });

        // Sync button
        const syncKmlBtn = document.getElementById('syncKmlBtn');
        syncKmlBtn?.addEventListener('click', async () => {
            if (!navigator.onLine) {
                M.toast({ html: '⚠️ Offline - Synchronisation nicht möglich', displayLength: 3000 });
                return;
            }

            M.toast({ html: 'Synchronisiere Reviere...', displayLength: 2000 });

            try {
                const result = await window.kmlManager.syncReviere();

                if (result.success) {
                    let message = `✓ Reviere synchronisiert`;
                    if (result.downloaded > 0) {
                        message += `: ${result.downloaded} neu`;
                    }
                    if (result.deleted > 0) {
                        message += `, ${result.deleted} gelöscht`;
                    }
                    if (result.downloaded === 0 && result.deleted === 0) {
                        message = `✓ Alle Reviere aktuell`;
                    }
                    M.toast({ html: message, displayLength: 4000 });

                    // Karte neu laden wenn Änderungen vorhanden
                    if (this.map && (result.downloaded > 0 || result.deleted > 0)) {
                        await this.loadAllBoundaries();
                        this.fitBoundaries();
                    }
                } else {
                    M.toast({ html: `✗ Sync fehlgeschlagen: ${result.message}`, displayLength: 5000 });
                }
            } catch (error) {
                console.error('Sync-Fehler:', error);
                M.toast({ html: '✗ Synchronisation fehlgeschlagen', displayLength: 4000 });
            }
        });

        // Labels Toggle button
        let labelsVisible = localStorage.getItem('mapLabelsVisible') !== 'false';
        const toggleLabelsBtn = document.getElementById('toggleLabelsBtn');

        // Initiale Einstellung anwenden
        if (!labelsVisible) {
            document.body.classList.add('hide-point-labels');
            if (toggleLabelsBtn) {
                toggleLabelsBtn.classList.remove('purple');
                toggleLabelsBtn.classList.add('grey');
            }
        }

        toggleLabelsBtn?.addEventListener('click', () => {
            labelsVisible = !labelsVisible;
            localStorage.setItem('mapLabelsVisible', labelsVisible);

            console.log(`[MapView] Labels Toggle: ${labelsVisible ? 'SICHTBAR' : 'AUSGEBLENDET'}`);
            console.log(`[MapView] Body-Klasse "hide-point-labels":`, document.body.classList.contains('hide-point-labels'));

            if (labelsVisible) {
                document.body.classList.remove('hide-point-labels');
                toggleLabelsBtn.classList.remove('grey');
                toggleLabelsBtn.classList.add('purple');
                M.toast({ html: '✓ Labels werden angezeigt', displayLength: 2000 });
            } else {
                document.body.classList.add('hide-point-labels');
                toggleLabelsBtn.classList.remove('purple');
                toggleLabelsBtn.classList.add('grey');
                M.toast({ html: '✓ Labels sind ausgeblendet', displayLength: 2000 });
            }

            console.log(`[MapView] Nach Toggle - Body-Klasse "hide-point-labels":`, document.body.classList.contains('hide-point-labels'));
        });

        // Fullscreen button
        const fullscreenBtn = document.getElementById('fullscreenBtn');
        fullscreenBtn?.addEventListener('click', () => {
            document.body.classList.toggle('map-fullscreen');
            if (document.body.classList.contains('map-fullscreen')) {
                fullscreenBtn.querySelector('i').textContent = 'fullscreen_exit';
                M.toast({ html: 'Vollbildmodus aktiviert', displayLength: 2000 });
            } else {
                fullscreenBtn.querySelector('i').textContent = 'fullscreen';
                M.toast({ html: 'Vollbildmodus beendet', displayLength: 2000 });
            }
            setTimeout(() => this.map?.invalidateSize(), 100);
        });

        // Offline Download button
        const downloadOfflineBtn = document.getElementById('downloadOfflineBtn');
        downloadOfflineBtn?.addEventListener('click', async () => {
            if (!this.map) {
                M.toast({ html: 'Karte nicht geladen', displayLength: 2000 });
                return;
            }

            const bounds = this.map.getBounds();
            const currentZoom = this.map.getZoom();

            const minZoom = currentZoom;
            const maxZoom = Math.min(currentZoom + 2, 18);

            M.toast({
                html: `Lade Karten-Tiles herunter (Zoom ${minZoom}-${maxZoom})...`,
                displayLength: 3000
            });

            try {
                const downloader = new OfflineMapDownloader();
                const result = await downloader.downloadArea(
                    bounds,
                    minZoom,
                    maxZoom,
                    (progress) => {
                        console.log(`Download-Fortschritt: ${progress.downloaded}/${progress.total}`);
                    }
                );

                M.toast({
                    html: `✓ ${result.downloaded} Tiles heruntergeladen`,
                    displayLength: 4000
                });
            } catch (error) {
                console.error('Offline-Download fehlgeschlagen:', error);
                M.toast({
                    html: '✗ Download fehlgeschlagen',
                    displayLength: 3000
                });
            }
        });
    }

    /**
     * Befüllt den Layer-Selector mit verfügbaren Karten
     */
    populateLayerSelector() {
        const layerSelector = document.getElementById('mapLayerSelector');
        if (!layerSelector) return;

        const savedLayer = localStorage.getItem('selectedMapLayer') || 'OpenStreetMap';

        Object.keys(this.baseLayers).forEach(layerName => {
            const layerItem = document.createElement('div');
            layerItem.className = 'map-layer-item';

            const label = document.createElement('label');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'baseLayer';
            radio.id = `layer-${layerName}`;
            radio.value = layerName;
            radio.checked = layerName === savedLayer;

            radio.addEventListener('change', () => {
                this.switchBaseLayer(layerName);
            });

            label.appendChild(radio);
            label.appendChild(document.createTextNode(` ${layerName}`));
            layerItem.appendChild(label);
            layerSelector.appendChild(layerItem);
        });
    }

    /**
     * Wechselt den Basis-Layer
     */
    switchBaseLayer(layerName) {
        if (this.currentLayer) {
            this.map.removeLayer(this.currentLayer);
        }

        this.currentLayer = this.baseLayers[layerName];
        this.currentLayer.addTo(this.map);

        // Speichere Auswahl
        localStorage.setItem('selectedMapLayer', layerName);

        console.log('Switched to layer:', layerName);
        if (typeof M !== 'undefined' && M.toast) {
            M.toast({ html: `Karte gewechselt zu: ${layerName}`, displayLength: 2000 });
        }
    }

    /**
     * Befüllt die Liste der hochgeladenen KML-Dateien
     */
    async populateUploadedKmlList() {
        const listContainer = document.getElementById('uploadedKmlList');
        if (!listContainer) return;

        try {
            // Hole user-uploaded KML-Dateien
            const userKmls = await this.kmlManager.getUserUploadedKmls();

            if (userKmls.length === 0) {
                listContainer.innerHTML = `
                    <div style="padding: 10px; color: #999; font-size: 12px; text-align: center;">
                        Keine hochgeladenen Dateien
                    </div>
                `;
                return;
            }

            listContainer.innerHTML = '';

            userKmls.forEach(kml => {
                const kmlItem = document.createElement('div');
                kmlItem.className = 'map-layer-item';
                kmlItem.style.display = 'flex';
                kmlItem.style.justifyContent = 'space-between';
                kmlItem.style.alignItems = 'center';
                kmlItem.style.padding = '8px';
                kmlItem.style.borderBottom = '1px solid #f0f0f0';

                // Display original filename or hashed filename
                const displayName = kml.originalFilename || kml.filename;

                kmlItem.innerHTML = `
                    <div style="flex: 1; overflow: hidden;">
                        <div style="font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${kml.filename}">
                            ${displayName}
                        </div>
                        <div style="font-size: 11px; color: #999;">
                            ${new Date(kml.uploaded).toLocaleDateString('de-DE')}
                        </div>
                    </div>
                    <button class="btn-small waves-effect waves-light red delete-kml-btn"
                            data-filename="${kml.filename}"
                            style="padding: 0 8px; height: 28px; line-height: 28px;">
                        <i class="material-icons" style="font-size: 18px;">delete</i>
                    </button>
                `;

                listContainer.appendChild(kmlItem);
            });

            // Add event listeners to delete buttons
            const deleteButtons = listContainer.querySelectorAll('.delete-kml-btn');
            deleteButtons.forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const filename = btn.getAttribute('data-filename');
                    await this.handleDeleteKml(filename);
                });
            });

        } catch (error) {
            console.error('[MapView] Fehler beim Laden der KML-Liste:', error);
            listContainer.innerHTML = `
                <div style="padding: 10px; color: #f44336; font-size: 12px; text-align: center;">
                    Fehler beim Laden der Liste
                </div>
            `;
        }
    }

    /**
     * Behandelt das Löschen (Archivieren) einer KML-Datei
     * @param {string} filename - Dateiname
     */
    async handleDeleteKml(filename) {
        // Bestätigung
        if (!confirm(`Möchten Sie die Datei "${filename}" wirklich archivieren?\n\nDie Datei wird auf dem Server in .old umbenannt und lokal entfernt.`)) {
            return;
        }

        try {
            M.toast({ html: `Archiviere "${filename}"...`, displayLength: 2000 });

            const result = await this.kmlManager.archiveKml(filename);

            if (result.success) {
                M.toast({ html: `✓ ${result.message}`, displayLength: 4000 });

                // UI aktualisieren
                await this.populateUploadedKmlList();

                // Karte neu laden
                if (this.map) {
                    await this.loadAllBoundaries();
                    this.fitBoundaries();
                }
            } else {
                M.toast({ html: `✗ ${result.message}`, displayLength: 4000 });
            }

        } catch (error) {
            console.error('[MapView] Fehler beim Archivieren:', error);
            M.toast({ html: `✗ Archivierung fehlgeschlagen: ${error.message}`, displayLength: 4000 });
        }
    }

    /**
     * Initialisiert die Suchfunktion (deprecated - wird nicht mehr verwendet)
     */
    initSearch() {
        const searchInput = document.querySelector('.map-search-input');
        const searchResults = document.querySelector('.map-search-results');

        if (!searchInput || !searchResults) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            searchResults.innerHTML = '';

            if (query.length < 2) {
                return;
            }

            // Suche nach Features
            const featureResults = this.searchIndex.filter(item =>
                item.name.toLowerCase().includes(query) ||
                (item.description && item.description.toLowerCase().includes(query))
            );

            featureResults.forEach(result => {
                const resultItem = document.createElement('div');
                resultItem.className = 'map-search-result-item';
                resultItem.innerHTML = `<i class="material-icons">place</i> ${result.name}`;
                resultItem.addEventListener('click', () => {
                    // Show layer
                    const checkbox = document.getElementById(`layer-${result.parentLayer}`);
                    if (checkbox) {
                        checkbox.checked = true;
                        this.boundaryLayers[result.parentLayer].addTo(this.map);
                    }

                    // Zoom to feature
                    this.map.fitBounds(result.layer.getBounds());
                    result.layer.openPopup();

                    searchInput.value = '';
                    searchResults.innerHTML = '';
                });

                searchResults.appendChild(resultItem);
            });

            // Ortssuche über Photon API
            if (query.length >= 3) {
                const searchingItem = document.createElement('div');
                searchingItem.className = 'map-search-result-item map-search-loading';
                searchingItem.innerHTML = '<i class="material-icons">search</i> Suche nach Orten...';
                searchResults.appendChild(searchingItem);

                fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=de`)
                    .then(response => response.json())
                    .then(data => {
                        const loadingItem = document.querySelector('.map-search-loading');
                        if (loadingItem) loadingItem.remove();

                        if (data.features && data.features.length > 0) {
                            if (featureResults.length > 0) {
                                const divider = document.createElement('div');
                                divider.className = 'map-search-divider';
                                divider.textContent = 'Orte';
                                searchResults.appendChild(divider);
                            }

                            data.features.forEach(place => {
                                const props = place.properties;
                                const coords = place.geometry.coordinates;

                                const resultItem = document.createElement('div');
                                resultItem.className = 'map-search-result-item map-place-result';

                                let displayName = props.name || '';
                                if (props.street) displayName += ', ' + props.street;
                                if (props.city) displayName += ', ' + props.city;

                                resultItem.innerHTML = `<i class="material-icons">location_on</i> ${displayName}`;
                                resultItem.addEventListener('click', () => {
                                    this.map.setView([coords[1], coords[0]], 15);

                                    const marker = L.marker([coords[1], coords[0]])
                                        .addTo(this.map)
                                        .bindPopup(displayName)
                                        .openPopup();

                                    setTimeout(() => this.map.removeLayer(marker), 60000);

                                    searchInput.value = '';
                                    searchResults.innerHTML = '';
                                });

                                searchResults.appendChild(resultItem);
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Fehler bei der Ortssuche:', error);
                        const loadingItem = document.querySelector('.map-search-loading');
                        if (loadingItem) {
                            loadingItem.innerHTML = '<i class="material-icons">error</i> Fehler bei der Ortssuche';
                            loadingItem.style.color = 'red';
                        }
                    });
            }
        });
    }

    /**
     * Lädt und zeigt alle KML-Reviergrenzen an
     * @returns {Promise<number>} - Anzahl geladener Grenzen
     */
    async loadAllBoundaries() {
        try {
            // Entferne bestehende Boundary-Layer
            this.clearBoundaries();

            // Hole alle KML-Dateien
            const kmlFiles = await this.kmlManager.getAllKmlLocal();

            let boundaryCount = 0;
            const layerCheckboxContainer = document.getElementById('mapLayerCheckboxes');

            if (layerCheckboxContainer) {
                layerCheckboxContainer.innerHTML = '';
            }

            for (const kmlFile of kmlFiles) {
                // Verwende filename (von Upload) oder name (alte Daten) - Fallback zu "Unbenannt"
                const layerName = kmlFile.filename || kmlFile.name || 'Unbenannt';

                console.log(`[MapView] Lade Boundary: ${layerName}`, {
                    hasContent: !!kmlFile.content,
                    contentLength: kmlFile.content?.length,
                    revier: kmlFile.revier
                });

                if (!kmlFile.content) {
                    console.warn(`[MapView] KML-Datei ${layerName} hat keinen Content!`);
                    continue;
                }

                const geometries = this.kmlManager.parseKmlCoordinates(kmlFile.content);

                console.log(`[MapView] ${layerName}: ${geometries.length} Geometrien gefunden`);

                if (geometries.length === 0) {
                    console.warn(`[MapView] Keine Geometrien in ${layerName} gefunden!`);
                    continue;
                }

                // Create layer group
                const layerGroup = L.layerGroup();

                for (const geometry of geometries) {
                    try {
                        // Verwende Farbe basierend auf StyleURL (gleiche StyleURL = gleiche Farbe)
                        let defaultColor;
                        if (geometry.type === 'Point' && geometry.styleUrl) {
                            defaultColor = this.getColorForStyleUrl(geometry.styleUrl);
                        } else {
                            defaultColor = this.getRandomColor();
                        }

                        const style = {
                            color: geometry.style?.color || defaultColor,
                            weight: geometry.style?.weight || 2,
                            fillOpacity: geometry.style?.fillOpacity !== undefined ? geometry.style.fillOpacity : 0.2
                        };

                        console.log(`[MapView] Erstelle ${geometry.type} "${geometry.name}" mit Style:`, style);

                        let leafletLayer = null;

                        // Erstelle entsprechenden Leaflet-Layer basierend auf Geometrie-Typ
                        if (geometry.type === 'Polygon') {
                            const latLngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);
                            leafletLayer = L.polygon(latLngs, style);
                        } else if (geometry.type === 'LineString') {
                            const latLngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);
                            leafletLayer = L.polyline(latLngs, {
                                color: style.color,
                                weight: style.weight
                            });
                        } else if (geometry.type === 'Point') {
                            // Point hat nur eine Koordinate
                            const coord = geometry.coordinates[0];
                            const latLng = [coord[1], coord[0]];

                            // Verwende CircleMarker für bessere Sichtbarkeit
                            leafletLayer = L.circleMarker(latLng, {
                                color: style.color,
                                fillColor: style.color,
                                fillOpacity: 0.7,
                                radius: 6,
                                weight: 2
                            });

                            // Füge permanentes Label über dem Punkt hinzu
                            if (geometry.name) {
                                leafletLayer.bindTooltip(geometry.name, {
                                    permanent: true,
                                    direction: 'top',
                                    className: 'point-label',
                                    offset: [0, -10]
                                });
                            }
                        }

                        if (leafletLayer) {
                            // Popup mit Name und optional Description (ohne Typ und Folder)
                            let popupContent = `<b>${geometry.name}</b>`;
                            if (geometry.description) {
                                popupContent += `<br><i>${geometry.description}</i>`;
                            }
                            leafletLayer.bindPopup(popupContent);

                            layerGroup.addLayer(leafletLayer);

                            // Add to search index
                            this.searchIndex.push({
                                name: geometry.name || 'Unbenannt',
                                description: geometry.description || '',
                                type: geometry.type,
                                layer: leafletLayer,
                                parentLayer: layerName
                            });

                            boundaryCount++;
                        }
                    } catch (error) {
                        console.error(`[MapView] Fehler beim Erstellen von "${geometry.name}":`, error);
                    }
                }

                this.boundaryLayers[layerName] = layerGroup;

                // Automatisch zur Karte hinzufügen und anzeigen
                layerGroup.addTo(this.map);

                // Add checkbox to control panel
                if (layerCheckboxContainer) {
                    const layerItem = document.createElement('div');
                    layerItem.className = 'map-layer-item';

                    const label = document.createElement('label');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `layer-${layerName}`;
                    checkbox.checked = true; // Standardmäßig angezeigt

                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) {
                            layerGroup.addTo(this.map);
                            this.map.fitBounds(layerGroup.getBounds());
                        } else {
                            this.map.removeLayer(layerGroup);
                        }
                    });

                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(` ${layerName}`));
                    layerItem.appendChild(label);
                    layerCheckboxContainer.appendChild(layerItem);
                }
            }

            // Auto-Zoom auf alle Boundaries wenn vorhanden
            if (boundaryCount > 0) {
                setTimeout(() => {
                    this.fitBoundaries();
                    console.log(`[MapView] Auto-zoomed to ${boundaryCount} boundaries`);
                }, 200);
            } else {
                console.warn('[MapView] Keine Boundaries zum Anzeigen gefunden!');
            }

            console.log(`[MapView] loadAllBoundaries abgeschlossen: ${boundaryCount} Boundaries, ${Object.keys(this.boundaryLayers).length} Layers`);

            return boundaryCount;

        } catch (error) {
            console.error('[MapView] Fehler beim Laden der Reviergrenzen:', error);
            return 0;
        }
    }

    /**
     * Toggle all layers on/off
     * @param {boolean} show - True to show all, false to hide all
     */
    toggleAllLayers(show) {
        for (const [name, layer] of Object.entries(this.boundaryLayers)) {
            const checkbox = document.getElementById(`layer-${name}`);
            if (checkbox) {
                checkbox.checked = show;
                if (show) {
                    layer.addTo(this.map);
                } else {
                    this.map.removeLayer(layer);
                }
            }
        }

        if (show && Object.keys(this.boundaryLayers).length > 0) {
            this.fitBoundaries();
        }
    }

    /**
     * Fügt eine Reviergrenze zur Karte hinzu
     * @param {Array} coordinates - Array von [lng, lat] Koordinaten
     * @param {string} name - Name der Grenze
     * @param {Object} options - Polygon-Optionen
     */
    addBoundary(coordinates, name, options = {}) {
        // Leaflet erwartet [lat, lng], KML hat [lng, lat]
        const latLngs = coordinates.map(coord => [coord[1], coord[0]]);

        const defaultOptions = {
            color: '#FF6B6B',
            weight: 2,
            fillOpacity: 0.2
        };

        const polygonOptions = { ...defaultOptions, ...options };

        const polygon = L.polygon(latLngs, polygonOptions).addTo(this.map);

        // Popup mit Name
        if (name) {
            polygon.bindPopup(`<b>${name}</b>`);
        }

        this.boundaryLayers.push(polygon);

        return polygon;
    }

    /**
     * Entfernt alle Reviergrenzen
     */
    clearBoundaries() {
        for (const [name, layer] of Object.entries(this.boundaryLayers)) {
            if (this.map.hasLayer(layer)) {
                this.map.removeLayer(layer);
            }
        }
        this.boundaryLayers = {};
        this.searchIndex = [];
    }

    /**
     * Zoomt auf alle Reviergrenzen
     */
    fitBoundaries() {
        console.log('[MapView] fitBoundaries() aufgerufen');

        if (Object.keys(this.boundaryLayers).length === 0) {
            console.log('[MapView] Keine boundaryLayers vorhanden');
            return;
        }

        const allPolygons = [];

        // Extrahiere alle individuellen Polygone aus den LayerGroups
        for (const [name, layerGroup] of Object.entries(this.boundaryLayers)) {
            if (this.map.hasLayer(layerGroup)) {
                console.log(`[MapView] Layer "${name}" ist auf Karte sichtbar`);

                // Hole alle Layer aus der LayerGroup
                layerGroup.eachLayer(function(layer) {
                    allPolygons.push(layer);
                });
            } else {
                console.log(`[MapView] Layer "${name}" ist NICHT auf Karte sichtbar`);
            }
        }

        console.log(`[MapView] ${allPolygons.length} Polygone für Zoom gefunden`);

        if (allPolygons.length > 0) {
            try {
                const group = L.featureGroup(allPolygons);
                const bounds = group.getBounds();

                console.log('[MapView] Bounds berechnet:', bounds);

                this.map.fitBounds(bounds, {
                    padding: [50, 50]
                });

                console.log('[MapView] fitBounds erfolgreich ausgeführt');
            } catch (error) {
                console.error('[MapView] Fehler beim fitBounds:', error);
            }
        } else {
            console.warn('[MapView] Keine Polygone zum Zoomen gefunden!');
        }
    }

    /**
     * Fügt einen Marker zur Karte hinzu (z.B. für Kamera-Position)
     * @param {number} lat - Breitengrad
     * @param {number} lng - Längengrad
     * @param {Object} options - Marker-Optionen
     * @returns {Object} - Leaflet Marker
     */
    addMarker(lat, lng, options = {}) {
        const marker = L.marker([lat, lng], options).addTo(this.markersLayer);

        if (options.popup) {
            marker.bindPopup(options.popup);
        }

        return marker;
    }

    /**
     * Entfernt alle Marker
     */
    clearMarkers() {
        this.markersLayer.clearLayers();
    }

    /**
     * Zentriert die Karte auf eine Position
     * @param {number} lat - Breitengrad
     * @param {number} lng - Längengrad
     * @param {number} zoom - Zoom-Level
     */
    centerOn(lat, lng, zoom = 13) {
        this.map.setView([lat, lng], zoom);
    }

    /**
     * Toggle Location Tracking
     */
    toggleLocationTracking() {
        if (this.isLocating) {
            this.stopLocationTracking();
        } else {
            this.startLocationTracking();
        }
    }

    /**
     * Start continuous location tracking
     */
    startLocationTracking() {
        if (this.watchId) return;

        const locationBtn = document.getElementById('toggleLocationBtn');
        if (locationBtn) {
            locationBtn.innerHTML = '<i class="material-icons left spin">gps_fixed</i>Tracking...';
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => this.updateLocation(position),
            (error) => {
                console.warn('Geolocation error:', error);
                M.toast({ html: 'Standortermittlung fehlgeschlagen', displayLength: 3000 });
                this.stopLocationTracking();
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
        );

        this.isLocating = true;
    }

    /**
     * Stop location tracking
     */
    stopLocationTracking() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }

        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
            this.userMarker = null;
        }

        if (this.accuracyCircle) {
            this.map.removeLayer(this.accuracyCircle);
            this.accuracyCircle = null;
        }

        this.isLocating = false;

        const locationBtn = document.getElementById('toggleLocationBtn');
        if (locationBtn) {
            locationBtn.innerHTML = '<i class="material-icons left">my_location</i>Standort';
        }
    }

    /**
     * Update location on map
     * @param {GeolocationPosition} position
     */
    updateLocation(position) {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;

        // Remove old markers
        if (this.userMarker) this.map.removeLayer(this.userMarker);
        if (this.accuracyCircle) this.map.removeLayer(this.accuracyCircle);

        // Add accuracy circle
        this.accuracyCircle = L.circle([lat, lng], {
            radius: accuracy,
            color: '#4CAF50',
            fillColor: '#4CAF50',
            fillOpacity: 0.15,
            weight: 1
        }).addTo(this.map);

        // Add user marker
        const markerIcon = L.divIcon({
            className: 'user-location-marker',
            html: '<div style="background: #4CAF50; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.5);"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        this.userMarker = L.marker([lat, lng], {
            icon: markerIcon,
            zIndexOffset: 1000
        }).addTo(this.map);

        // Zoom to location if not already zoomed
        if (this.map.getZoom() < 16) {
            this.map.setView([lat, lng], 17);
        }
    }

    /**
     * Zeigt die aktuelle Position des Benutzers (einmalig)
     * @returns {Promise<Object>} - Position {lat, lng}
     */
    async showCurrentLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation nicht unterstützt'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;

                    // Marker für aktuelle Position
                    const marker = this.addMarker(lat, lng, {
                        popup: 'Ihre Position',
                        icon: L.icon({
                            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                            iconSize: [25, 41],
                            iconAnchor: [12, 41],
                            popupAnchor: [1, -34],
                            shadowSize: [41, 41]
                        })
                    });

                    marker.openPopup();
                    this.centerOn(lat, lng);

                    resolve({ lat, lng });
                },
                (error) => {
                    reject(error);
                }
            );
        });
    }

    /**
     * Add camera markers to map
     * Lädt Kamera-Status von txtFiles aus Reviere-Ordnern
     * @returns {Promise<number>} - Anzahl der geladenen Kameras
     */
    async loadCameraMarkers() {
        try {
            // Clear existing camera markers
            for (const marker of Object.values(this.cameraMarkers)) {
                this.map.removeLayer(marker);
            }
            this.cameraMarkers = {};

            const cameraListContainer = document.getElementById('mapCameraList');

            if (cameraListContainer) {
                cameraListContainer.innerHTML = '';
            }

            let cameraCount = 0;

            // Versuche Kamera-Status vom Server zu laden (aus txtFiles)
            let cameras = [];

            if (navigator.onLine) {
                try {
                    const response = await window.apiClient.getCameraStatus(7, true);
                    if (response.success) {
                        cameras = response.cameras;
                        console.log(`[MapView] ${cameras.length} Kameras vom Server geladen (gefiltert nach Polygon)`);
                    }
                } catch (error) {
                    console.warn('[MapView] Fehler beim Laden vom Server, verwende DB-Fallback:', error);
                }
            }

            // Fallback: Lade aus lokaler DB wenn Server nicht verfügbar
            if (cameras.length === 0) {
                const dbCameras = await window.dbManager.getAllCameras();
                cameras = dbCameras.filter(c => c.location && c.location.lat && c.location.lng)
                    .map(c => ({
                        cam_id: c.name,
                        latitude: c.location.lat,
                        longitude: c.location.lng,
                        imei: c.phone || 'N/A',
                        battery: null,
                        temperature: null,
                        from_db: true
                    }));
                console.log(`[MapView] ${cameras.length} Kameras aus DB geladen (Fallback)`);
            }

            for (const camera of cameras) {
                // Skip cameras without GPS
                if (!camera.latitude || !camera.longitude) {
                    continue;
                }

                cameraCount++;

                // Batterie-Status Farbe
                let batteryColor = '#999'; // Grau für unbekannt
                if (camera.battery !== null && camera.battery !== undefined) {
                    if (camera.battery >= 75) batteryColor = '#4CAF50'; // Grün
                    else if (camera.battery >= 50) batteryColor = '#FFC107'; // Gelb
                    else if (camera.battery >= 25) batteryColor = '#FF9800'; // Orange
                    else batteryColor = '#F44336'; // Rot
                }

                // Create camera marker
                const cameraIcon = L.divIcon({
                    className: 'camera-marker',
                    html: `<i class="material-icons" style="color: ${batteryColor}; font-size: 32px;">photo_camera</i>`,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32],
                    popupAnchor: [0, -32]
                });

                // Erstelle detailliertes Popup
                let popupContent = `<div style="min-width: 200px;">`;
                popupContent += `<h6 style="margin: 0 0 8px 0; font-weight: 600;">${camera.cam_id || 'Kamera'}</h6>`;

                if (!camera.from_db) {
                    // Status-Informationen aus txtFile
                    if (camera.imei) {
                        popupContent += `<div style="margin: 4px 0;"><strong>IMEI:</strong> ${camera.imei}</div>`;
                    }
                    if (camera.battery !== null && camera.battery !== undefined) {
                        popupContent += `<div style="margin: 4px 0;"><strong>Batterie:</strong> <span style="color: ${batteryColor};">${camera.battery}%</span></div>`;
                    }
                    if (camera.temperature !== null && camera.temperature !== undefined) {
                        popupContent += `<div style="margin: 4px 0;"><strong>Temperatur:</strong> ${camera.temperature}°C</div>`;
                    }
                    if (camera.signal_quality !== null && camera.signal_quality !== undefined) {
                        popupContent += `<div style="margin: 4px 0;"><strong>Signal:</strong> ${camera.signal_quality}</div>`;
                    }
                    if (camera.total_pics !== null && camera.total_pics !== undefined) {
                        popupContent += `<div style="margin: 4px 0;"><strong>Bilder:</strong> ${camera.total_pics}</div>`;
                    }
                    if (camera.sd_percent !== null && camera.sd_percent !== undefined) {
                        popupContent += `<div style="margin: 4px 0;"><strong>SD-Karte:</strong> ${camera.sd_percent}% belegt</div>`;
                    }
                    if (camera.date_iso) {
                        const date = new Date(camera.date_iso);
                        popupContent += `<div style="margin: 4px 0; font-size: 11px; color: #999;"><strong>Letzter Status:</strong> ${date.toLocaleString('de-DE')}</div>`;
                    }
                    if (camera.in_revier) {
                        popupContent += `<div style="margin: 4px 0; font-size: 11px; color: #4CAF50;"><strong>Revier:</strong> ${camera.in_revier}</div>`;
                    }
                } else {
                    popupContent += `<div style="margin: 4px 0; color: #999; font-size: 11px;">Aus lokaler Datenbank</div>`;
                    popupContent += `<div style="margin: 4px 0;"><strong>IMEI:</strong> ${camera.imei}</div>`;
                }

                popupContent += `<div style="margin-top: 8px; font-size: 11px; color: #666;">`;
                popupContent += `GPS: ${camera.latitude.toFixed(6)}, ${camera.longitude.toFixed(6)}`;
                popupContent += `</div>`;
                popupContent += `</div>`;

                const marker = L.marker([camera.latitude, camera.longitude], {
                    icon: cameraIcon
                }).bindPopup(popupContent);

                this.cameraMarkers[camera.imei || camera.cam_id] = marker;

                // Add to camera list in control panel
                if (cameraListContainer) {
                    const cameraItem = document.createElement('div');
                    cameraItem.className = 'map-layer-item map-camera-item';
                    cameraItem.innerHTML = `
                        <label>
                            <input type="checkbox" id="camera-${camera.id}" checked>
                            <span>${camera.name}</span>
                        </label>
                    `;

                    const checkbox = cameraItem.querySelector('input');
                    checkbox.addEventListener('change', () => {
                        if (checkbox.checked) {
                            marker.addTo(this.map);
                        } else {
                            this.map.removeLayer(marker);
                        }
                    });

                    cameraItem.addEventListener('click', (e) => {
                        if (e.target.tagName !== 'INPUT') {
                            this.map.setView([camera.location.lat, camera.location.lng], 15);
                            marker.openPopup();
                        }
                    });

                    cameraListContainer.appendChild(cameraItem);

                    // Add marker to map by default
                    marker.addTo(this.map);
                }
            }

            // Auto-Zoom auf Kameras wenn keine Boundaries vorhanden
            if (cameraCount > 0 && Object.keys(this.boundaryLayers).length === 0) {
                setTimeout(() => {
                    this.fitCameraMarkers();
                    console.log(`Auto-zoomed to ${cameraCount} cameras (no boundaries found)`);
                }, 200);
            }

            return cameraCount;
        } catch (error) {
            console.error('Error loading camera markers:', error);
            return 0;
        }
    }

    /**
     * Zoomt die Karte auf alle sichtbaren Kamera-Marker
     */
    fitCameraMarkers() {
        const markers = Object.values(this.cameraMarkers);
        if (markers.length === 0) return;

        const group = L.featureGroup(markers);
        this.map.fitBounds(group.getBounds(), {
            padding: [50, 50],
            maxZoom: 15
        });
    }

    /**
     * Generiert eine zufällige Farbe
     * @returns {string} - Hex-Farbe
     */
    getRandomColor() {
        // Optimierte Farbpalette für Kartenhintergründe
        // Entfernt: Grün-, Blau-, Cyan-, Grautöne (schlechter Kontrast auf Karten)
        // Behalten: Rot, Pink, Orange, Gelb, Violett (guter Kontrast)
        const colors = [
            '#FF6B6B', // Rot
            '#FF7675', // Hellrot
            '#FF3838', // Kräftiges Rot
            '#FFA07A', // Lachs
            '#FF6348', // Tomatenrot
            '#E17055', // Koralle
            '#FD79A8', // Pink
            '#FF69B4', // Hot Pink
            '#FF1493', // Deep Pink
            '#6C5CE7', // Lila
            '#A29BFE', // Hellviolett
            '#8B00FF', // Violett
            '#FDCB6E', // Gelb
            '#FFD700', // Gold
            '#FFEAA7', // Hellgelb
            '#FFA500', // Orange
            '#FF8C00', // Dark Orange
            '#FAB1A0', // Pfirsich
            '#DC143C', // Crimson
            '#C71585'  // Medium Violet Red
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Gibt eine konsistente Farbe für eine StyleURL zurück
     * Gleiche StyleURL = gleiche Farbe (wird gecached)
     * @param {string} styleUrl - StyleURL aus KML
     * @returns {string} - Hex-Farbe
     */
    getColorForStyleUrl(styleUrl) {
        if (!styleUrl) {
            return this.getRandomColor();
        }

        // Wenn wir diese StyleURL schon kennen, gib die gleiche Farbe zurück
        if (this.styleUrlColorMap[styleUrl]) {
            return this.styleUrlColorMap[styleUrl];
        }

        // Neue StyleURL: generiere Farbe und cache sie
        const color = this.getRandomColor();
        this.styleUrlColorMap[styleUrl] = color;

        console.log(`[MapView] Neue StyleURL "${styleUrl}" -> Farbe ${color}`);

        return color;
    }

    /**
     * Aktiviert Zeichnen-Modus (für zukünftige Erweiterung)
     * @param {Function} callback - Callback mit gezeichneten Koordinaten
     */
    enableDrawMode(callback) {
        // TODO: Integration mit Leaflet.draw oder ähnlichem Plugin
        console.log('Zeichnen-Modus noch nicht implementiert');
    }

    /**
     * Exportiert aktuelle Ansicht als Bild
     * @returns {Promise<string>} - Data URL des Bildes
     */
    async exportAsImage() {
        // TODO: Integration mit leaflet-image oder html2canvas
        console.log('Export als Bild noch nicht implementiert');
        return null;
    }

    /**
     * Zerstört die Karte
     */
    destroy() {
        if (this.map) {
            this.map.remove();
            this.map = null;
        }
    }
}

// Singleton-Instanz erstellen
const mapView = new MapView();

// Exportieren
window.mapView = mapView;
