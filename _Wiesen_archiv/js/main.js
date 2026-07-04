// Hauptinitialisierung der Anwendung
async function init() {
    const container = document.getElementById('layerCheckboxes');

    for (const name in kmzData) {
        const prefixMatch = name.match(/Wiesen Diverse - (\w+)/);
        const prefixFilter = prefixMatch ? prefixMatch[1] : null;

        await loadKMZ(name, kmzData[name], prefixFilter);
        
        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = name;
        checkbox.onchange = function() {
            if (this.checked) {
                layers[name].addTo(map);
                map.fitBounds(layers[name].getBounds());
            } else {
                layers[name].removeFrom(map);
            }
        };
        
        const label = document.createElement('label');
        label.htmlFor = name;
        label.innerHTML = name;
        
        layerItem.appendChild(checkbox);
        layerItem.appendChild(label);
        container.appendChild(layerItem);
    }
    
    // Event Listener für Suchfunktion
    setupSearch();
    
    // Event Listener für auf- und zuklappbare Panels
    if (typeof setupCollapsiblePanels === 'function') {
        setupCollapsiblePanels();
    } else {
        console.warn('setupCollapsiblePanels ist nicht definiert');
    }
}

// Event-Listener für E-Mail-Modal-Fenster
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('email-modal');
    const closeBtn = document.querySelector('.close');
    const cancelBtn = document.getElementById('cancel-email');
    
    if (closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = "none";
        };
    }
    
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            modal.style.display = "none";
        };
    }
    
    // Wenn außerhalb des Modals geklickt wird
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
});

// Anwendung initialisieren
init();

// Einfache Lösung für mobiles Control-Panel
document.querySelector('.control-header').addEventListener('click', function() {
    document.querySelector('.control-panel').classList.toggle('open');
});
  
// Layout beim Laden anpassen
window.addEventListener('load', function() {
    // Cache-Version anzeigen, falls verfügbar
    setTimeout(function() {
        if (typeof displayCacheVersion === 'function') {
            displayCacheVersion();
        } else {
            console.warn('displayCacheVersion ist nicht definiert');
        }
    }, 1000);

    if (window.innerWidth < 768) {
        // Schließe das Panel standardmäßig auf Mobilgeräten
        document.querySelector('.control-content').classList.add('collapsed');
    }

    // Polygon-Tools initialisieren - Klick-Events für die Section Header
    const sectionHeaders = document.querySelectorAll('.section-header');
    sectionHeaders.forEach(header => {
        const icon = header.querySelector('i');
        const content = header.nextElementSibling;
        
        header.addEventListener('click', function() {
        content.classList.toggle('collapsed');
        icon.classList.toggle('fa-chevron-down');
        icon.classList.toggle('fa-chevron-up');
        });
    });

    // Hover-Details für Polygon-Punkte
    const polygonPointsElement = document.getElementById('polygon-points');
    if (polygonPointsElement) {
        polygonPointsElement.addEventListener('mouseover', function(e) {
            if (e.target && e.target.tagName === 'LI') {
                const index = parseInt(e.target.dataset.index);
                if (!isNaN(index) && typeof polygonMarkers !== 'undefined' && 
                    index >= 0 && index < polygonMarkers.length) {
                    polygonMarkers[index].openPopup();
                }
            }
        });
    }
});