import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

from pyproj import Geod               # pip install pyproj
import pandas as pd                   # pip install pandas

# ---------------------------------------------------------------------------
# Parameter
# ---------------------------------------------------------------------------
KMZ_DIR = Path("kmz_files")                 # Ordner mit allen .kmz
GEOD    = Geod(ellps="WGS84")         # Ellipsoid für geodätische Flächen

# ---------------------------------------------------------------------------
# Hilfsfunktionen
# ---------------------------------------------------------------------------
def area_of_ring(coords: list[tuple[float, float]]) -> float:
    """
    Geodätische Fläche eines Rings (Länge len>=3)
    coords: [(lon, lat), …]  – muss NICHT geschlossen sein
    Rückgabe: Fläche in m² (immer positiv)
    """
    lons, lats = zip(*coords)
    # pyproj.Geod.polygon_area_perimeter liefert Vorzeichen anhand Umlaufrichtung
    area, _ = GEOD.polygon_area_perimeter(lons, lats)[:2]
    return abs(area)

def extract_polygons(kml_bytes: bytes) -> list[list[tuple[float, float]]]:
    """
    Liefert eine Liste aller äußeren Polygon‑Ringe im KML‑Dokument.
    """
    ns = {"kml": "http://www.opengis.net/kml/2.2"}
    root = ET.fromstring(kml_bytes)

    rings = []
    for poly in root.findall(".//kml:Polygon", ns):
        outer = poly.find(".//kml:outerBoundaryIs/kml:LinearRing/kml:coordinates", ns)
        if outer is None or not outer.text:
            continue
        # Koordinaten‑String → Liste (lon,lat)  – Höhen werden ignoriert
        coords = [
            tuple(map(float, c.split(",")[:2]))
            for c in outer.text.strip().split()
        ]
        if len(coords) >= 3:
            rings.append(coords)
    return rings

# ---------------------------------------------------------------------------
# Hauptlauf
# ---------------------------------------------------------------------------
rows = []

for kmz_path in KMZ_DIR.glob("*.kmz"):
    with zipfile.ZipFile(kmz_path) as zf:
        # fast alle KMZ enthalten nur eine KML – wir nehmen die erste
        kml_name = next(name for name in zf.namelist() if name.endswith(".kml"))
        kml_data = zf.read(kml_name)

    polygons = extract_polygons(kml_data)
    areas = [area_of_ring(r) for r in polygons]

    rows.append(
        {
            "Datei": kmz_path.stem,
            "Polygone": len(polygons),
            "Fläche_m2": sum(areas),
            "Fläche_ha": sum(areas) / 10_000,
        }
    )

df = pd.DataFrame(rows).sort_values("Datei")
df.loc["Summe"] = [
    "—",
    df["Polygone"].sum(),
    df["Fläche_m2"].sum(),
    df["Fläche_ha"].sum(),
]

# hübsch formatieren
pd.options.display.float_format = "{:,.2f}".format
print(df)

"""
Beispiel‑Ausgabe (gekürzt):

             Datei  Polygone  Fläche_m2  Fläche_ha
0        Abspacher        17  117,890.75     11.79
1           Burger         2    5,510.32      0.55
...
10   Mayer-Sauerer        32  458,201.72     45.82
...
Summe          —        127 1,616,487.80    161.65
"""
