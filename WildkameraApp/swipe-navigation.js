/**
 * swipe-navigation.js
 * Touch-Swipe Navigation für Tab-Wechsel zwischen Kamera- und Kartenansicht
 */

class SwipeNavigation {
    constructor() {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 50; // Mindestdistanz für Swipe in Pixel
        this.maxVerticalDistance = 100; // Max vertikale Bewegung für horizontalen Swipe
        this.isScrolling = false;
        this.currentTab = 'cameras-tab'; // Default tab
    }

    /**
     * Initialisiert die Swipe-Navigation
     */
    init() {
        const container = document.querySelector('.main-container');

        if (!container) {
            console.warn('Main container not found for swipe navigation');
            return;
        }

        // Touch Events
        container.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: true });
        container.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        container.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: true });

        // Aktuellen Tab tracken
        this.trackCurrentTab();

        console.log('Swipe navigation initialized');
    }

    /**
     * Touch Start Handler
     */
    handleTouchStart(e) {
        this.touchStartX = e.changedTouches[0].screenX;
        this.touchStartY = e.changedTouches[0].screenY;
        this.isScrolling = false;
    }

    /**
     * Touch Move Handler
     */
    handleTouchMove(e) {
        const touchX = e.changedTouches[0].screenX;
        const touchY = e.changedTouches[0].screenY;

        const diffX = Math.abs(touchX - this.touchStartX);
        const diffY = Math.abs(touchY - this.touchStartY);

        // Erkenne ob es ein vertikales Scrollen ist
        if (diffY > diffX) {
            this.isScrolling = true;
        }

        // Verhindere Standard-Scroll nur bei horizontalem Swipe
        if (!this.isScrolling && diffX > 10) {
            // Optional: Visuelle Feedback während Swipe
            // e.preventDefault(); // Vorsicht: kann Scrolling blockieren
        }
    }

    /**
     * Touch End Handler
     */
    handleTouchEnd(e) {
        this.touchEndX = e.changedTouches[0].screenX;
        this.touchEndY = e.changedTouches[0].screenY;

        // Wenn vertikales Scrollen erkannt wurde, ignoriere Swipe
        if (this.isScrolling) {
            return;
        }

        this.handleSwipe();
    }

    /**
     * Verarbeitet die Swipe-Geste
     */
    handleSwipe() {
        const diffX = this.touchEndX - this.touchStartX;
        const diffY = Math.abs(this.touchEndY - this.touchStartY);

        // Prüfe ob es ein gültiger horizontaler Swipe ist
        if (Math.abs(diffX) < this.minSwipeDistance) {
            return; // Zu kurze Bewegung
        }

        if (diffY > this.maxVerticalDistance) {
            return; // Zu viel vertikale Bewegung
        }

        // Swipe nach rechts (von links nach rechts)
        if (diffX > 0) {
            console.log('Swipe right detected - switch to cameras');
            this.switchTab('cameras-tab');
        }
        // Swipe nach links (von rechts nach links)
        else {
            console.log('Swipe left detected - switch to map');
            this.switchTab('map-tab');
        }
    }

    /**
     * Wechselt den Tab
     */
    switchTab(targetTab) {
        // Verhindere Wechsel zum gleichen Tab
        if (this.currentTab === targetTab) {
            console.log('Already on', targetTab);
            return;
        }

        const tabLink = document.querySelector(`.main-tabs a[href="#${targetTab}"]`);

        if (tabLink) {
            // Trigger Click Event auf Tab
            tabLink.click();
            this.currentTab = targetTab;

            // Haptic Feedback (falls unterstützt)
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }

            console.log('Switched to', targetTab);
        }
    }

    /**
     * Trackt den aktuellen Tab
     */
    trackCurrentTab() {
        // Observer für Tab-Änderungen
        const observer = new MutationObserver(() => {
            const camerasTab = document.getElementById('cameras-tab');
            const mapTab = document.getElementById('map-tab');

            if (camerasTab && camerasTab.style.display !== 'none') {
                this.currentTab = 'cameras-tab';
            } else if (mapTab && mapTab.style.display !== 'none') {
                this.currentTab = 'map-tab';
            }
        });

        // Beobachte beide Tabs
        const camerasTab = document.getElementById('cameras-tab');
        const mapTab = document.getElementById('map-tab');

        if (camerasTab) {
            observer.observe(camerasTab, { attributes: true, attributeFilter: ['style'] });
        }
        if (mapTab) {
            observer.observe(mapTab, { attributes: true, attributeFilter: ['style'] });
        }

        // Initial check
        if (mapTab && mapTab.style.display !== 'none') {
            this.currentTab = 'map-tab';
        }
    }

    /**
     * Deaktiviert die Swipe-Navigation
     */
    destroy() {
        const container = document.querySelector('.main-container');
        if (container) {
            container.removeEventListener('touchstart', this.handleTouchStart);
            container.removeEventListener('touchmove', this.handleTouchMove);
            container.removeEventListener('touchend', this.handleTouchEnd);
        }
    }
}

// Singleton-Instanz erstellen
const swipeNavigation = new SwipeNavigation();

// Exportieren
window.swipeNavigation = swipeNavigation;
