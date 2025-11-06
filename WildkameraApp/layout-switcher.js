/**
 * layout-switcher.js
 * Verwaltet den Wechsel zwischen Tab-Layout und Map-First-Layout
 */

class LayoutSwitcher {
    constructor() {
        this.currentLayout = localStorage.getItem('appLayout') || 'tabs';
    }

    /**
     * Initialisiert das Layout basierend auf gespeicherter Präferenz
     */
    initLayout() {
        if (this.currentLayout === 'map-first') {
            this.switchToMapFirstLayout();
        } else {
            this.switchToTabLayout();
        }
    }

    /**
     * Wechselt zum Tab-Layout (Option A)
     */
    switchToTabLayout() {
        this.currentLayout = 'tabs';
        localStorage.setItem('appLayout', 'tabs');

        // Zeige Tab-Navigation
        document.querySelector('.main-tabs').parentElement.style.display = 'block';

        // Standard Tab-Logik
        document.getElementById('cameras-tab').style.display = 'block';
        document.getElementById('map-tab').style.display = 'none';

        // Verstecke Map-First spezifische Elemente
        const sidebar = document.getElementById('camera-sidebar');
        if (sidebar) {
            sidebar.style.display = 'none';
        }

        // Container-Klasse anpassen
        const container = document.querySelector('.main-container');
        container.classList.remove('map-first-layout');
        container.classList.add('tab-layout');

        console.log('Layout: Tab-Modus aktiviert');
    }

    /**
     * Wechselt zum Map-First-Layout (Option B)
     */
    switchToMapFirstLayout() {
        this.currentLayout = 'map-first';
        localStorage.setItem('appLayout', 'map-first');

        // Verstecke Tab-Navigation
        document.querySelector('.main-tabs').parentElement.style.display = 'none';

        // Zeige Karte als Hauptansicht
        document.getElementById('cameras-tab').style.display = 'none';
        document.getElementById('map-tab').style.display = 'block';

        // Zeige Camera-Sidebar
        this.createCameraSidebar();

        // Container-Klasse anpassen
        const container = document.querySelector('.main-container');
        container.classList.remove('tab-layout');
        container.classList.add('map-first-layout');

        // Initialisiere Karte
        setTimeout(() => {
            if (!window.mapView.map) {
                window.mapView.initMap('map');
                window.mapView.loadAllBoundaries();
            } else {
                window.mapView.map.invalidateSize();
            }
        }, 100);

        console.log('Layout: Map-First-Modus aktiviert');
    }

    /**
     * Erstellt eine Kamera-Sidebar für Map-First Layout
     */
    createCameraSidebar() {
        // Prüfe ob Sidebar bereits existiert
        let sidebar = document.getElementById('camera-sidebar');

        if (!sidebar) {
            // Erstelle Sidebar
            sidebar = document.createElement('div');
            sidebar.id = 'camera-sidebar';
            sidebar.className = 'camera-sidebar';

            sidebar.innerHTML = `
                <div class="sidebar-header">
                    <h6>Kameras</h6>
                    <button class="btn-small waves-effect waves-light" onclick="document.getElementById('addCameraButton').click()">
                        <i class="material-icons">add</i>
                    </button>
                </div>
                <div class="sidebar-content">
                    <ul id="sidebar-camera-list" class="collection"></ul>
                </div>
            `;

            // Füge zur Map-Tab hinzu
            document.getElementById('map-tab').prepend(sidebar);
        }

        sidebar.style.display = 'block';

        // Synchronisiere Kameraliste
        this.syncCameraList();
    }

    /**
     * Synchronisiert die Kameraliste in der Sidebar
     */
    syncCameraList() {
        const mainList = document.getElementById('cameraList');
        const sidebarList = document.getElementById('sidebar-camera-list');

        if (!sidebarList) return;

        // Kopiere Kameraliste
        sidebarList.innerHTML = mainList.innerHTML;

        // Event-Listener für Sidebar-Einträge
        sidebarList.querySelectorAll('.collection-item').forEach(item => {
            item.addEventListener('click', (e) => {
                // Finde entsprechenden Eintrag in Hauptliste und triggere Event
                const cameraId = item.dataset.id;
                if (cameraId) {
                    const mainItem = mainList.querySelector(`[data-id="${cameraId}"]`);
                    if (mainItem) {
                        mainItem.click();
                    }
                }
            });
        });
    }

    /**
     * Holt das aktuelle Layout
     * @returns {string} - 'tabs' oder 'map-first'
     */
    getCurrentLayout() {
        return this.currentLayout;
    }
}

// Singleton-Instanz
const layoutSwitcher = new LayoutSwitcher();

// Exportieren
window.layoutSwitcher = layoutSwitcher;
