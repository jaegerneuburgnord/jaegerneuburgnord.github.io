// Zuerst die Quadkey-Umrechnungsfunktion definieren
function tileXYToQuadKey(x, y, z) {
    let quadKey = "";
    for (let i = z; i > 0; i--) {
        let digit = 0;
        const mask = 1 << (i - 1);
        if ((x & mask) !== 0) {
            digit += 1;
        }
        if ((y & mask) !== 0) {
            digit += 2;
        }
        quadKey += digit;
    }
    return quadKey;
}

// Erstelle eine eigene TileLayer-Klasse für Bing
L.TileLayer.Bing = L.TileLayer.extend({
    getTileUrl: function(coords) {
        const quadkey = tileXYToQuadKey(coords.x, coords.y, coords.z);
        // Ersetze {q} mit quadkey und verarbeite {s} richtig
        return this._url
            .replace('{q}', quadkey)
            .replace('{s}', this.options.subdomains[Math.abs(coords.x + coords.y) % this.options.subdomains.length]);
    }
});

// Bing-Layer als Konstruktor implementieren
L.tileLayer.bing = function(url, options) {
    return new L.TileLayer.Bing(url, options);
};

// Bayern Atlas mit mehreren Serveralternativen (intergeo30-40)
const bayernAtlasServerOptions = {
    subdomains: ['31', '32', '33', '34', '35', '36', '37', '38', '39', '40'],
    attribution: '© Bayerische Vermessungsverwaltung'
};

// Jetzt die baseLayers mit korrekten Bing-Layern
const baseLayers = {
    'Bayern Atlas Luftbild': L.tileLayer('https://intergeo{s}.bayernwolke.de/betty/g_satdop20_komplett/{z}/{x}/{y}', bayernAtlasServerOptions),
    'Bing Aerial': L.tileLayer.bing('https://t{s}.ssl.ak.tiles.virtualearth.net/tiles/a{q}?g=1', {
        subdomains: ['0', '1', '2', '3', '4'],
        attribution: '© Microsoft'
    }),
    'Bing Road': L.tileLayer.bing('https://t{s}.ssl.ak.dynamic.tiles.virtualearth.net/comp/ch/{q}?mkt=de-de&it=G,L&shading=hill&og=1668&n=z', {
        subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
        attribution: '© Microsoft'
    }),
    "Google Hybrid": L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {subdomains:['mt0','mt1','mt2','mt3']}),
    "Google Satellite": L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {subdomains:['mt0','mt1','mt2','mt3']}),
    "Google Terrain": L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {subdomains:['mt0','mt1','mt2','mt3']}),
    "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
};

var wmsOverlay = L.tileLayer.wms(
  'https://anbaurecht.traffgoroad.com/geoserver/fba/wms?',
  {
    layers: 'flurstuecke',
    format: 'image/png',
    transparent: true,
    version: '1.1.1'
  }
);

var bayerAtlasOverlay = L.tileLayer('https://intergeo{s}.bayernwolke.de/betty/c_g_atkishybrid_alkisinvers_parzellar/{z}/{x}/{y}', bayernAtlasServerOptions);

// Karte initialisieren
const map = L.map('map', {
    center: [47.6, 13.2],
    zoom: 8,
    layers: [baseLayers["Google Satellite"]]
});

// Overlay Layers
var overlays = {
    'Flurstücke': wmsOverlay,
    'Flurstücke Bayern Atlas': bayerAtlasOverlay
};

wmsOverlay.addTo(map);

// Layer-Namen setzen für die Sortierung
Object.entries(baseLayers).forEach(([name, layer]) => {
    layer.name = name;
});

// Layer-Control mit Sortierung
const layerControl = L.control.layers(baseLayers, overlays, {
    collapsed: true,
    position: 'bottomright',
    sortLayers: true,
    sortFunction: function(a, b) {
        // Finde die Namen der Layer aus dem baseLayers-Objekt
        let nameA = '';
        let nameB = '';
        
        // Sichere Implementierung der Namensfindung
        for (const [name, layer] of Object.entries(baseLayers)) {
            if (layer === a) nameA = name;
            if (layer === b) nameB = name;
        }
        
        // Sichere Überprüfung für localeCompare
        if (nameA && nameB) {
            return nameA.localeCompare(nameB);
        }
        return 0; // Keine Änderung der Reihenfolge, wenn einer der Namen nicht gefunden wurde
    }
}).addTo(map);

// Leer, gemäß Anforderung
const kmzData = {};

// Speicher für Layer und Suchdaten
const layers = {};
const searchIndex = [];