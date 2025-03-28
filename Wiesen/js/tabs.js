// Tab-Wechsel-Funktionalität
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Tab-Wechsel-Event für jede Tab-Schaltfläche
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Aktiven Tab hervorheben
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Aktiven Tab-Inhalt anzeigen
            const tabId = this.getAttribute('data-tab');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabId) {
                    content.classList.add('active');
                }
            });
            
            // Spezielle Aktionen für bestimmte Tabs
            if (tabId === 'polygon-tab') {
                // Tab für Polygon-Tools wird aktiviert
                if (typeof updatePolygonSelectOptions === 'function') {
                    updatePolygonSelectOptions();
                }
            }
        });
    });