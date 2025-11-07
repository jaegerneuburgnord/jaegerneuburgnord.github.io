"""
Kamera-Status Parser für txtFiles aus Reviere-Ordnern
Liest Status-Dateien, parst GPS-Koordinaten und prüft Point-in-Polygon
"""
import os
import re
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


def dms_to_decimal(dms_string: str) -> Optional[float]:
    """
    Konvertiert DMS (Degrees Minutes Seconds) zu Dezimalgrad

    Format: N48*45'58" oder E011*09'58"

    Args:
        dms_string: GPS-String im Format N48*45'58" oder E011*09'58"

    Returns:
        float: Dezimalgrad (negativ für S/W)
    """
    try:
        # Pattern: (N|S|E|W)(\d+)\*(\d+)'(\d+)"
        pattern = r"([NSEW])(\d+)\*(\d+)'(\d+)\""
        match = re.match(pattern, dms_string.strip())

        if not match:
            logger.warning(f"GPS-Format nicht erkannt: {dms_string}")
            return None

        direction, degrees, minutes, seconds = match.groups()

        # Umrechnung zu Dezimalgrad
        decimal = float(degrees) + float(minutes)/60 + float(seconds)/3600

        # Negativ für Süd und West
        if direction in ['S', 'W']:
            decimal = -decimal

        return decimal

    except Exception as e:
        logger.error(f"Fehler beim GPS-Parsing '{dms_string}': {e}")
        return None


def parse_gps_line(gps_line: str) -> Optional[Tuple[float, float]]:
    """
    Parst GPS-Zeile und gibt (latitude, longitude) zurück

    Format: GPS:N48*45'58" E011*09'58"

    Returns:
        tuple: (lat, lng) oder None bei Fehler
    """
    try:
        # GPS:N48*45'58" E011*09'58"
        gps_line = gps_line.replace("GPS:", "").strip()
        parts = gps_line.split()

        if len(parts) != 2:
            logger.warning(f"GPS-Zeile hat nicht 2 Teile: {gps_line}")
            return None

        lat_str, lng_str = parts

        lat = dms_to_decimal(lat_str)
        lng = dms_to_decimal(lng_str)

        if lat is None or lng is None:
            return None

        return (lat, lng)

    except Exception as e:
        logger.error(f"Fehler beim GPS-Zeile Parsing '{gps_line}': {e}")
        return None


def parse_camera_status_file(file_path: str) -> Optional[Dict]:
    """
    Parst eine Kamera-Status-Datei

    Beispiel-Format:
    IMEI:860946061745033
    CSQ:11
    CamID:LANGER HIEBR
    Temp:11 Celsius Degree
    Date:30/09/2025  23:57:07
    Battery:100%
    SD:371M/30432M
    Total Pics:6554
    Send times:1
    GPS:N48*45'58" E011*09'58"

    Returns:
        dict: Parsed data oder None bei Fehler
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        data = {}

        # IMEI
        imei_match = re.search(r'IMEI:(\S+)', content)
        if imei_match:
            data['imei'] = imei_match.group(1)

        # CamID
        camid_match = re.search(r'CamID:(.+)', content)
        if camid_match:
            data['cam_id'] = camid_match.group(1).strip()

        # CSQ (Signal Quality)
        csq_match = re.search(r'CSQ:(\d+)', content)
        if csq_match:
            data['signal_quality'] = int(csq_match.group(1))

        # Temperature
        temp_match = re.search(r'Temp:(\d+)', content)
        if temp_match:
            data['temperature'] = int(temp_match.group(1))

        # Date
        date_match = re.search(r'Date:(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2}:\d{2})', content)
        if date_match:
            date_str = date_match.group(1)
            try:
                data['date'] = datetime.strptime(date_str, '%d/%m/%Y %H:%M:%S')
                data['date_iso'] = data['date'].isoformat()
            except:
                data['date_str'] = date_str

        # Battery
        battery_match = re.search(r'Battery:(\d+)%', content)
        if battery_match:
            data['battery'] = int(battery_match.group(1))

        # SD Card
        sd_match = re.search(r'SD:(\d+)M/(\d+)M', content)
        if sd_match:
            data['sd_used_mb'] = int(sd_match.group(1))
            data['sd_total_mb'] = int(sd_match.group(2))
            data['sd_percent'] = round((data['sd_used_mb'] / data['sd_total_mb']) * 100, 1)

        # Total Pictures
        pics_match = re.search(r'Total Pics:(\d+)', content)
        if pics_match:
            data['total_pics'] = int(pics_match.group(1))

        # GPS
        gps_match = re.search(r'GPS:(.+)', content)
        if gps_match:
            gps_line = gps_match.group(1)
            coords = parse_gps_line("GPS:" + gps_line)
            if coords:
                data['latitude'] = coords[0]
                data['longitude'] = coords[1]

        # File metadata
        data['file_path'] = file_path
        data['file_name'] = os.path.basename(file_path)
        file_mtime = os.path.getmtime(file_path)
        data['file_modified'] = datetime.fromtimestamp(file_mtime).isoformat()

        return data

    except Exception as e:
        logger.error(f"Fehler beim Parsen von {file_path}: {e}")
        return None


def point_in_polygon(point: Tuple[float, float], polygon: List[Tuple[float, float]]) -> bool:
    """
    Ray-casting Algorithmus für Point-in-Polygon Check

    Args:
        point: (lat, lng)
        polygon: Liste von (lat, lng) Koordinaten

    Returns:
        bool: True wenn Punkt im Polygon liegt
    """
    x, y = point
    n = len(polygon)
    inside = False

    p1x, p1y = polygon[0]
    for i in range(1, n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y

    return inside


def get_camera_status_files(
    reviere_base_dir: str = "/mnt/synology/Reviere",
    days_back: int = 7
) -> List[Dict]:
    """
    Liest alle Kamera-Status-Dateien aus den Reviere-Ordnern

    Args:
        reviere_base_dir: Basis-Verzeichnis für Reviere
        days_back: Wie viele Tage zurück sollen Dateien gelesen werden

    Returns:
        Liste von parsed camera status dicts
    """
    camera_statuses = []
    cutoff_date = datetime.now() - timedelta(days=days_back)

    try:
        if not os.path.exists(reviere_base_dir):
            logger.warning(f"Reviere-Verzeichnis nicht gefunden: {reviere_base_dir}")
            return []

        # Durchsuche alle Revier-Unterordner
        for revier_dir in Path(reviere_base_dir).iterdir():
            if not revier_dir.is_dir():
                continue

            txt_files_dir = revier_dir / "txtFiles"

            if not txt_files_dir.exists():
                logger.debug(f"Kein txtFiles-Ordner in {revier_dir.name}")
                continue

            logger.info(f"Suche Status-Dateien in {txt_files_dir}")

            # Finde alle .txt Dateien
            for txt_file in txt_files_dir.glob("*.txt"):
                # Prüfe Änderungsdatum
                file_mtime = datetime.fromtimestamp(txt_file.stat().st_mtime)

                if file_mtime < cutoff_date:
                    logger.debug(f"Datei zu alt: {txt_file.name} ({file_mtime})")
                    continue

                # Parse Datei
                status = parse_camera_status_file(str(txt_file))

                if status:
                    status['revier'] = revier_dir.name
                    camera_statuses.append(status)
                    logger.info(f"Status gelesen: {status.get('cam_id', 'Unknown')} aus {revier_dir.name}")

        logger.info(f"Insgesamt {len(camera_statuses)} Kamera-Status-Dateien gefunden")
        return camera_statuses

    except Exception as e:
        logger.error(f"Fehler beim Lesen der Status-Dateien: {e}")
        return []


def filter_cameras_in_polygons(
    cameras: List[Dict],
    polygons: Dict[str, List[Tuple[float, float]]]
) -> List[Dict]:
    """
    Filtert Kameras die innerhalb der Revier-Polygone liegen

    Args:
        cameras: Liste von Kamera-Status-Dicts mit latitude/longitude
        polygons: Dict {revier_name: [(lat, lng), ...]}

    Returns:
        Liste von Kameras die in Polygonen liegen, erweitert um 'in_revier' Field
    """
    filtered_cameras = []

    for camera in cameras:
        lat = camera.get('latitude')
        lng = camera.get('longitude')

        if lat is None or lng is None:
            logger.debug(f"Kamera {camera.get('cam_id', 'Unknown')} hat keine GPS-Koordinaten")
            continue

        point = (lat, lng)
        camera_revier = camera.get('revier')

        # Prüfe ob Punkt im entsprechenden Revier-Polygon liegt
        if camera_revier in polygons:
            polygon = polygons[camera_revier]

            if point_in_polygon(point, polygon):
                camera['in_polygon'] = True
                camera['in_revier'] = camera_revier
                filtered_cameras.append(camera)
                logger.debug(f"Kamera {camera.get('cam_id')} ist in {camera_revier} Polygon")
            else:
                logger.debug(f"Kamera {camera.get('cam_id')} NICHT in {camera_revier} Polygon")
        else:
            logger.debug(f"Kein Polygon für Revier {camera_revier} gefunden")

    logger.info(f"{len(filtered_cameras)} von {len(cameras)} Kameras liegen in Polygonen")
    return filtered_cameras
