// KMZ-Daten laden und Suchindex aufbauen
async function loadKMZ(name, url, prefixFilter=null) {
    const response = await fetch(url);
    const blob = await response.blob();
    const zip = await JSZip.loadAsync(blob);
    const kmlFile = zip.file(/\.kml$/i)[0];
    const kmlText = await kmlFile.async('text');
    const parser = new DOMParser();
    const kml = parser.parseFromString(kmlText, 'text/xml');
    const geojson = toGeoJSON.kml(kml);

    const geoLayer = L.geoJSON(geojson, {
        filter: function(feature) {
            if (prefixFilter) {
                return feature.properties.name.startsWith(prefixFilter);
            }
            return true;
        },
        onEachFeature: function(feature, layer) {
            let popupText = feature.properties.name || 'Unbenannt';
            if (feature.properties.description) {
                // Convert What3Words URLs to clickable links
                const processedDescription = convertWhat3WordsToLinks(feature.properties.description);
                popupText += "<br>" + processedDescription;
            }
            layer.bindPopup(popupText);
            
            // Index für die Suche (keep the original description for search indexing)
            const searchItem = {
                name: feature.properties.name || 'Unbenannt',
                description: feature.properties.description || '',
                layer: layer,
                parentLayer: name
            };
            searchIndex.push(searchItem);
        }
    });

    layers[name] = geoLayer;
}

// Suchfunktionalität einrichten
function setupSearch() {
    const searchInput = document.querySelector('.search-input');
    const searchResults = document.querySelector('.search-results');
    const enablePlaceSearch = document.getElementById('enable-place-search');
    
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        searchResults.innerHTML = '';
        
        if (query.length < 2) {
            return;
        }
        
        // Suche nach übereinstimmenden Features
        const featureResults = searchIndex.filter(item => {
            // If no description or name matches directly, skip further checks
            if (item.name.toLowerCase().includes(query)) {
                return true; // Keep items that match by name regardless
            }
            
            // If no description, can't match on it
            if (!item.description) {
                return false;
            }
            
            // Split description into lines (either by <br> or fallback to the whole description)
            const lines = item.description.includes('<br>') 
                ? item.description.split('<br>') 
                : [item.description];
            
            // Check if any non-what3words line matches the query
            const hasNonWhat3WordsMatch = lines.some(line => 
                !line.toLowerCase().includes('what3words') && 
                line.toLowerCase().includes(query)
            );
            
            return hasNonWhat3WordsMatch;
        });            

        featureResults.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'search-result-item';
            resultItem.innerHTML = '<i class="fas fa-map-pin"></i> ' + result.name;
            resultItem.addEventListener('click', function() {
                // Bestehende Funktionalität beibehalten
                const checkbox = document.getElementById(result.parentLayer);
                checkbox.checked = true;
                layers[result.parentLayer].addTo(map);
                
                map.fitBounds(result.layer.getBounds());
                result.layer.openPopup();
                
                searchInput.value = '';
                searchResults.innerHTML = '';
            });
            
            searchResults.appendChild(resultItem);
        });
        
        // Zusätzlich nach Orten suchen, wenn der Query länger als 3 Zeichen ist
        if (enablePlaceSearch.checked && query.length >= 3) {
            // Hinweis hinzufügen, dass die Ortssuche läuft
            const searchingItem = document.createElement('div');
            searchingItem.className = 'search-result-item search-loading';
            searchingItem.innerHTML = '<i class="fas fa-search"></i> Suche nach Orten...';
            searchResults.appendChild(searchingItem);
            
            // Replace the Nominatim API call with this Photon API call
            fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5&lang=de`)
                .then(response => response.json())
                .then(data => {
                    // Remove loading indicator
                    const loadingItem = document.querySelector('.search-loading');
                    if (loadingItem) loadingItem.remove();
                    
                    if (data.features && data.features.length > 0) {
                        // Add divider if we have both feature results and place results
                        if (featureResults.length > 0) {
                            const divider = document.createElement('div');
                            divider.className = 'search-divider';
                            divider.textContent = 'Orte';
                            searchResults.appendChild(divider);
                        }
                        
                        // Display place search results
                        data.features.forEach(place => {
                            const properties = place.properties;
                            const coordinates = place.geometry.coordinates; // [lon, lat]
                            
                            const resultItem = document.createElement('div');
                            resultItem.className = 'search-result-item place-result';
                            
                            // Create display name from Photon results
                            let displayName = properties.name || '';
                            if (properties.street) displayName += ', ' + properties.street;
                            if (properties.city) displayName += ', ' + properties.city;
                            if (properties.state) displayName += ', ' + properties.state;
                            
                            resultItem.innerHTML = `<i class="fas fa-map-marker-alt"></i> ${displayName}`;
                            resultItem.addEventListener('click', function() {
                                // Pan to location (note: Photon returns [lon, lat], but Leaflet uses [lat, lon])
                                map.setView([coordinates[1], coordinates[0]], 15);
                                
                                // Add a temporary marker
                                const marker = L.marker([coordinates[1], coordinates[0]])
                                    .addTo(map)
                                    .bindPopup(displayName)
                                    .openPopup();
                                
                                // Remove marker after 60 seconds
                                setTimeout(() => map.removeLayer(marker), 60000);
                                
                                searchInput.value = '';
                                searchResults.innerHTML = '';
                            });
                            
                            searchResults.appendChild(resultItem);
                        });
                    }
                })
                .catch(error => {
                    console.error('Fehler bei der Ortssuche:', error);
                    const loadingItem = document.querySelector('.search-loading');
                    if (loadingItem) {
                        loadingItem.innerHTML = '<i class="fas fa-exclamation-circle"></i> Fehler bei der Ortssuche';
                        loadingItem.style.color = 'red';
                    }
                });
            }
    });

    // Save the preference in localStorage
    enablePlaceSearch.addEventListener('change', function() {
        localStorage.setItem('enablePlaceSearch', this.checked);
    });
    
    // Load saved preference
    if (localStorage.getItem('enablePlaceSearch') !== null) {
        enablePlaceSearch.checked = localStorage.getItem('enablePlaceSearch') === 'true';
    }
}