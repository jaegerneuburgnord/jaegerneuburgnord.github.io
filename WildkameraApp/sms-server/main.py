"""
FastAPI Server für SMS-Versand über USB-Modem
Unterstützt Wildkamera SMS-Kommandos
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime
import asyncio
import os
import shutil
import glob
import hashlib
import zipfile
import io

from sms_modem import SmsModem
from settings_manager import SettingsManager
from camera_status_parser import (
    get_camera_status_files,
    filter_cameras_in_polygons,
    parse_gps_line
)

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# FastAPI App erstellen
app = FastAPI(
    title="Wildkamera SMS Server",
    description="API zum Versenden von SMS-Kommandos über USB-Modem",
    version="1.0.0"
)

# CORS aktivieren (wichtig für Web-App)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In Produktion spezifische Origins angeben
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Globale Instanzen
sms_modem: Optional[SmsModem] = None
settings_manager: SettingsManager = SettingsManager()

# Verzeichnis für KML-Dateien
KML_UPLOAD_DIR = "kml_files"
os.makedirs(KML_UPLOAD_DIR, exist_ok=True)

# Reviere-Verzeichnis für automatische KMZ-Erkennung
REVIERE_BASE_DIR = "/home/wildkamera/Reviere"

# Pydantic Models für API
class SmsRequest(BaseModel):
    phone_number: str
    message: str
    camera_id: Optional[str] = None

class SmsResponse(BaseModel):
    success: bool
    message: str
    timestamp: str
    sms_id: Optional[str] = None

class StatusResponse(BaseModel):
    status: str
    modem_connected: bool
    modem_info: Optional[dict] = None
    pending_sms_count: int = 0

class ModemConfigRequest(BaseModel):
    port: str
    baudrate: int = 115200
    timeout: int = 10

class SettingsSaveRequest(BaseModel):
    camera_id: str
    settings: Dict[str, Any]

class SettingsResponse(BaseModel):
    success: bool
    message: str
    data: Optional[Dict[str, Any]] = None


# ==================== Helper Functions ====================

def calculate_file_hash(file_path: str) -> str:
    """Berechnet MD5-Hash einer Datei für Änderungserkennung"""
    hash_md5 = hashlib.md5()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_md5.update(chunk)
        return hash_md5.hexdigest()
    except Exception as e:
        logger.error(f"Fehler beim Hash-Berechnen von {file_path}: {e}")
        return ""


def scan_reviere_for_kmz() -> List[Dict[str, Any]]:
    """
    Durchsucht /home/wildkamera/Reviere zweistufig nach KMZ-Dateien:
    1. Finde alle Ordner namens "kmz" oder "KMZ"
    2. Suche in diesen Ordnern rekursiv nach .kmz Dateien

    Returns:
        Liste mit KMZ-Datei-Informationen
    """
    kmz_files = []

    if not os.path.exists(REVIERE_BASE_DIR):
        logger.warning(f"Reviere-Verzeichnis nicht gefunden: {REVIERE_BASE_DIR}")
        return kmz_files

    # Schritt 1: Finde alle "kmz" Ordner
    kmz_folders = []
    for root, dirs, files in os.walk(REVIERE_BASE_DIR):
        for dir_name in dirs:
            if dir_name.lower() == "kmz":
                kmz_folder_path = os.path.join(root, dir_name)
                kmz_folders.append(kmz_folder_path)
                logger.debug(f"Gefundener KMZ-Ordner: {kmz_folder_path}")

    logger.info(f"Gefundene KMZ-Ordner: {len(kmz_folders)}")

    # Schritt 2: Durchsuche jeden KMZ-Ordner rekursiv nach .kmz Dateien
    for kmz_folder in kmz_folders:
        search_pattern = os.path.join(kmz_folder, "**", "*.kmz")
        found_files = glob.glob(search_pattern, recursive=True)

        logger.debug(f"In {kmz_folder}: {len(found_files)} KMZ-Dateien gefunden")

        for file_path in found_files:
            try:
                # Extrahiere Revier-Namen aus Pfad
                relative_path = os.path.relpath(file_path, REVIERE_BASE_DIR)
                path_parts = relative_path.split(os.sep)
                revier_name = path_parts[0] if len(path_parts) > 0 else "Unknown"

                # Datei-Metadaten
                file_stat = os.stat(file_path)
                file_hash = calculate_file_hash(file_path)

                kmz_files.append({
                    "filename": os.path.basename(file_path),
                    "revier": revier_name,
                    "path": relative_path,
                    "full_path": file_path,
                    "size": file_stat.st_size,
                    "modified": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                    "hash": file_hash
                })

            except Exception as e:
                logger.error(f"Fehler beim Verarbeiten von {file_path}: {e}")

    logger.info(f"Gesamt gefundene KMZ-Dateien: {len(kmz_files)}")
    return kmz_files


@app.on_event("startup")
async def startup_event():
    """Initialisiert das SMS-Modem beim Start"""
    global sms_modem
    try:
        # Versuche automatisch ein Modem zu finden und zu verbinden
        sms_modem = SmsModem()
        await sms_modem.connect()
        logger.info("SMS-Modem erfolgreich initialisiert")
    except Exception as e:
        logger.warning(f"Modem konnte beim Start nicht initialisiert werden: {e}")
        logger.info("Server läuft weiter - Modem kann später konfiguriert werden")


@app.on_event("shutdown")
async def shutdown_event():
    """Trennt das SMS-Modem beim Herunterfahren"""
    global sms_modem
    if sms_modem:
        await sms_modem.disconnect()
        logger.info("SMS-Modem getrennt")


@app.get("/", response_model=dict)
async def root():
    """Root-Endpoint"""
    return {
        "service": "Wildkamera SMS Server",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/status", response_model=StatusResponse)
async def get_status():
    """Gibt den aktuellen Status des Servers und Modems zurück"""
    global sms_modem

    modem_connected = False
    modem_info = None

    if sms_modem and sms_modem.is_connected():
        modem_connected = True
        modem_info = await sms_modem.get_modem_info()

    return StatusResponse(
        status="online",
        modem_connected=modem_connected,
        modem_info=modem_info,
        pending_sms_count=0  # Kann erweitert werden für Queue-Verwaltung
    )


@app.post("/sms/send", response_model=SmsResponse)
async def send_sms(sms_request: SmsRequest):
    """
    Sendet eine SMS über das angebundene Modem

    Args:
        sms_request: SMS-Anfrage mit Telefonnummer und Nachricht

    Returns:
        SmsResponse mit Erfolgs-Status
    """
    global sms_modem

    # Prüfen ob Modem verbunden ist
    if not sms_modem or not sms_modem.is_connected():
        raise HTTPException(
            status_code=503,
            detail="SMS-Modem ist nicht verbunden. Bitte Modem konfigurieren."
        )

    try:
        logger.info(f"Sende SMS an {sms_request.phone_number}")
        logger.debug(f"Nachricht: {sms_request.message}")

        # SMS über Modem senden
        success = await sms_modem.send_sms(
            sms_request.phone_number,
            sms_request.message
        )

        if success:
            return SmsResponse(
                success=True,
                message="SMS erfolgreich gesendet",
                timestamp=datetime.now().isoformat(),
                sms_id=f"sms_{datetime.now().timestamp()}"
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="SMS konnte nicht gesendet werden"
            )

    except Exception as e:
        logger.error(f"Fehler beim Senden der SMS: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Senden der SMS: {str(e)}"
        )
    finally:
        # SMS-Log speichern
        settings_manager.save_sms_log({
            "phone_number": sms_request.phone_number,
            "message": sms_request.message,
            "camera_id": sms_request.camera_id,
            "success": success if 'success' in locals() else False
        })


@app.post("/sms/send-batch", response_model=dict)
async def send_batch_sms(sms_requests: List[SmsRequest]):
    """
    Sendet mehrere SMS nacheinander

    Args:
        sms_requests: Liste von SMS-Anfragen

    Returns:
        Dict mit Erfolgs- und Fehlerstatistiken
    """
    global sms_modem

    if not sms_modem or not sms_modem.is_connected():
        raise HTTPException(
            status_code=503,
            detail="SMS-Modem ist nicht verbunden"
        )

    results = {
        "total": len(sms_requests),
        "success": 0,
        "failed": 0,
        "details": []
    }

    for sms_req in sms_requests:
        try:
            success = await sms_modem.send_sms(
                sms_req.phone_number,
                sms_req.message
            )

            if success:
                results["success"] += 1
                results["details"].append({
                    "phone_number": sms_req.phone_number,
                    "status": "success"
                })
            else:
                results["failed"] += 1
                results["details"].append({
                    "phone_number": sms_req.phone_number,
                    "status": "failed"
                })

        except Exception as e:
            results["failed"] += 1
            results["details"].append({
                "phone_number": sms_req.phone_number,
                "status": "error",
                "error": str(e)
            })

    return results


@app.post("/modem/configure")
async def configure_modem(config: ModemConfigRequest):
    """
    Konfiguriert das SMS-Modem

    Args:
        config: Modem-Konfiguration (Port, Baudrate, Timeout)
    """
    global sms_modem

    try:
        # Wenn bereits ein Modem verbunden ist, trennen
        if sms_modem and sms_modem.is_connected():
            await sms_modem.disconnect()

        # Neues Modem erstellen und verbinden
        sms_modem = SmsModem(
            port=config.port,
            baudrate=config.baudrate,
            timeout=config.timeout
        )

        await sms_modem.connect()

        modem_info = await sms_modem.get_modem_info()

        return {
            "success": True,
            "message": "Modem erfolgreich konfiguriert",
            "modem_info": modem_info
        }

    except Exception as e:
        logger.error(f"Fehler bei der Modem-Konfiguration: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler bei der Modem-Konfiguration: {str(e)}"
        )


@app.get("/modem/ports")
async def list_available_ports():
    """
    Listet alle verfügbaren seriellen Ports auf

    Returns:
        Liste der verfügbaren Ports
    """
    try:
        from serial.tools import list_ports

        ports = []
        for port in list_ports.comports():
            ports.append({
                "device": port.device,
                "name": port.name,
                "description": port.description,
                "hwid": port.hwid
            })

        return {
            "ports": ports,
            "count": len(ports)
        }

    except Exception as e:
        logger.error(f"Fehler beim Auflisten der Ports: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Auflisten der Ports: {str(e)}"
        )


# ==================== Settings Endpoints ====================

@app.post("/settings/save", response_model=SettingsResponse)
async def save_settings(request: SettingsSaveRequest):
    """
    Speichert Kamera-Einstellungen

    Args:
        request: Kamera-ID und Einstellungen

    Returns:
        SettingsResponse mit Erfolgs-Status
    """
    try:
        success = settings_manager.save_camera_settings(
            request.camera_id,
            request.settings
        )

        if success:
            return SettingsResponse(
                success=True,
                message="Einstellungen erfolgreich gespeichert",
                data={"camera_id": request.camera_id}
            )
        else:
            raise HTTPException(
                status_code=500,
                detail="Fehler beim Speichern der Einstellungen"
            )

    except Exception as e:
        logger.error(f"Fehler beim Speichern der Einstellungen: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Speichern: {str(e)}"
        )


@app.get("/settings/last", response_model=SettingsResponse)
async def get_last_settings():
    """
    Holt die zuletzt verwendeten Einstellungen

    Returns:
        SettingsResponse mit letzten Einstellungen
    """
    try:
        last_settings = settings_manager.get_last_settings()

        if last_settings:
            return SettingsResponse(
                success=True,
                message="Letzte Einstellungen erfolgreich abgerufen",
                data=last_settings
            )
        else:
            return SettingsResponse(
                success=True,
                message="Keine gespeicherten Einstellungen vorhanden",
                data=None
            )

    except Exception as e:
        logger.error(f"Fehler beim Abrufen der letzten Einstellungen: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Abrufen: {str(e)}"
        )


@app.get("/settings/camera/{camera_id}", response_model=SettingsResponse)
async def get_camera_settings(camera_id: str):
    """
    Holt Einstellungen für eine bestimmte Kamera

    Args:
        camera_id: ID der Kamera

    Returns:
        SettingsResponse mit Kamera-Einstellungen
    """
    try:
        settings = settings_manager.get_camera_settings(camera_id)

        if settings:
            return SettingsResponse(
                success=True,
                message=f"Einstellungen für Kamera {camera_id} erfolgreich abgerufen",
                data={"camera_id": camera_id, "settings": settings}
            )
        else:
            return SettingsResponse(
                success=False,
                message=f"Keine Einstellungen für Kamera {camera_id} gefunden",
                data=None
            )

    except Exception as e:
        logger.error(f"Fehler beim Abrufen der Kamera-Einstellungen: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Abrufen: {str(e)}"
        )


@app.get("/settings/cameras")
async def get_all_cameras():
    """
    Holt alle gespeicherten Kameras und ihre Einstellungen

    Returns:
        Dictionary mit allen Kameras
    """
    try:
        cameras = settings_manager.get_all_cameras()
        return {
            "success": True,
            "cameras": cameras,
            "count": len(cameras)
        }
    except Exception as e:
        logger.error(f"Fehler beim Abrufen aller Kameras: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Abrufen: {str(e)}"
        )


@app.delete("/settings/camera/{camera_id}")
async def delete_camera_settings(camera_id: str):
    """
    Löscht Einstellungen für eine bestimmte Kamera

    Args:
        camera_id: ID der Kamera

    Returns:
        Erfolgs-Status
    """
    try:
        success = settings_manager.delete_camera_settings(camera_id)

        if success:
            return {
                "success": True,
                "message": f"Einstellungen für Kamera {camera_id} erfolgreich gelöscht"
            }
        else:
            raise HTTPException(
                status_code=404,
                detail=f"Keine Einstellungen für Kamera {camera_id} gefunden"
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fehler beim Löschen der Kamera-Einstellungen: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Löschen: {str(e)}"
        )


@app.get("/settings/sms-log")
async def get_sms_log(limit: int = 50):
    """
    Holt die letzten SMS-Log-Einträge

    Args:
        limit: Maximale Anzahl zurückzugebender Einträge

    Returns:
        Liste mit Log-Einträgen
    """
    try:
        log = settings_manager.get_sms_log(limit)
        return {
            "success": True,
            "log": log,
            "count": len(log)
        }
    except Exception as e:
        logger.error(f"Fehler beim Abrufen des SMS-Logs: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Abrufen: {str(e)}"
        )


# ==================== KML Endpoints ====================

@app.post("/kml/upload")
async def upload_kml(
    file: UploadFile = File(...),
    name: Optional[str] = None
):
    """
    Lädt eine KML-Datei für Reviergrenzen hoch

    Args:
        file: KML-Datei
        name: Optionaler Name für die Datei

    Returns:
        Erfolgs-Status und Dateiinformationen
    """
    try:
        # Überprüfe Dateityp
        if not file.filename.endswith('.kml'):
            raise HTTPException(
                status_code=400,
                detail="Nur KML-Dateien sind erlaubt"
            )

        # Verwende entweder den angegebenen Namen oder den Original-Dateinamen
        filename = name if name else file.filename
        if not filename.endswith('.kml'):
            filename += '.kml'

        file_path = os.path.join(KML_UPLOAD_DIR, filename)

        # Datei speichern
        with open(file_path, 'wb') as f:
            shutil.copyfileobj(file.file, f)

        # Dateiinhalt für Response lesen
        with open(file_path, 'r', encoding='utf-8') as f:
            kml_content = f.read()

        logger.info(f"KML-Datei hochgeladen: {filename}")

        return {
            "success": True,
            "message": "KML-Datei erfolgreich hochgeladen",
            "filename": filename,
            "size": os.path.getsize(file_path),
            "kml_content": kml_content  # Für direktes Speichern in der App
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fehler beim Hochladen der KML-Datei: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Hochladen: {str(e)}"
        )


@app.get("/kml/list")
async def list_kml_files():
    """
    Listet alle hochgeladenen KML-Dateien auf

    Returns:
        Liste der verfügbaren KML-Dateien
    """
    try:
        files = []

        if os.path.exists(KML_UPLOAD_DIR):
            for filename in os.listdir(KML_UPLOAD_DIR):
                if filename.endswith('.kml'):
                    file_path = os.path.join(KML_UPLOAD_DIR, filename)
                    files.append({
                        "filename": filename,
                        "size": os.path.getsize(file_path),
                        "modified": datetime.fromtimestamp(
                            os.path.getmtime(file_path)
                        ).isoformat()
                    })

        return {
            "success": True,
            "files": files,
            "count": len(files)
        }

    except Exception as e:
        logger.error(f"Fehler beim Auflisten der KML-Dateien: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Auflisten: {str(e)}"
        )


@app.get("/kml/download/{filename}")
async def download_kml(filename: str):
    """
    Lädt eine KML-Datei herunter

    Args:
        filename: Name der KML-Datei

    Returns:
        KML-Datei als Download
    """
    try:
        file_path = os.path.join(KML_UPLOAD_DIR, filename)

        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail="KML-Datei nicht gefunden"
            )

        # Dateiinhalt als Text zurückgeben für Offline-Speicherung
        with open(file_path, 'r', encoding='utf-8') as f:
            kml_content = f.read()

        return {
            "success": True,
            "filename": filename,
            "content": kml_content
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fehler beim Herunterladen der KML-Datei: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Herunterladen: {str(e)}"
        )


@app.delete("/kml/delete/{filename}")
async def delete_kml(filename: str):
    """
    Löscht eine KML-Datei

    Args:
        filename: Name der KML-Datei

    Returns:
        Erfolgs-Status
    """
    try:
        file_path = os.path.join(KML_UPLOAD_DIR, filename)

        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail="KML-Datei nicht gefunden"
            )

        os.remove(file_path)
        logger.info(f"KML-Datei gelöscht: {filename}")

        return {
            "success": True,
            "message": f"KML-Datei {filename} erfolgreich gelöscht"
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fehler beim Löschen der KML-Datei: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Löschen: {str(e)}"
        )


# ==================== Reviere KMZ Sync Endpoints ====================

@app.get("/reviere/kmz/list")
async def list_reviere_kmz():
    """
    Listet alle KMZ-Dateien aus /home/wildkamera/Reviere auf

    Returns:
        Liste aller gefundenen KMZ-Dateien mit Metadaten
    """
    try:
        kmz_files = scan_reviere_for_kmz()

        return {
            "success": True,
            "files": kmz_files,
            "count": len(kmz_files),
            "base_dir": REVIERE_BASE_DIR,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Fehler beim Scannen der Reviere: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Scannen: {str(e)}"
        )


@app.get("/reviere/kmz/download")
async def download_reviere_kmz(file_hash: str):
    """
    Lädt eine spezifische KMZ-Datei aus den Revieren herunter
    Identifiziert die Datei anhand des Hash-Werts

    Args:
        file_hash: MD5-Hash der Datei

    Returns:
        KMZ-Datei als Byte-Stream
    """
    try:
        kmz_files = scan_reviere_for_kmz()

        # Finde Datei anhand Hash
        target_file = None
        for f in kmz_files:
            if f["hash"] == file_hash:
                target_file = f
                break

        if not target_file:
            raise HTTPException(
                status_code=404,
                detail=f"KMZ-Datei mit Hash {file_hash} nicht gefunden"
            )

        file_path = target_file["full_path"]

        if not os.path.exists(file_path):
            raise HTTPException(
                status_code=404,
                detail="KMZ-Datei existiert nicht mehr"
            )

        # Lese Datei
        with open(file_path, 'rb') as f:
            file_content = f.read()

        logger.info(f"KMZ-Datei heruntergeladen: {target_file['filename']} ({target_file['revier']})")

        # Rückgabe als Binary Response
        return Response(
            content=file_content,
            media_type="application/vnd.google-earth.kmz",
            headers={
                "Content-Disposition": f"attachment; filename={target_file['filename']}",
                "X-Revier": target_file['revier'],
                "X-File-Hash": file_hash
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fehler beim Herunterladen der KMZ-Datei: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Herunterladen: {str(e)}"
        )


@app.get("/reviere/kmz/extract")
async def extract_kmz_to_kml(file_hash: str):
    """
    Extrahiert KML-Content aus einer KMZ-Datei

    Args:
        file_hash: MD5-Hash der KMZ-Datei

    Returns:
        Extrahierte KML-Inhalte als JSON
    """
    try:
        kmz_files = scan_reviere_for_kmz()

        # Finde Datei anhand Hash
        target_file = None
        for f in kmz_files:
            if f["hash"] == file_hash:
                target_file = f
                break

        if not target_file:
            raise HTTPException(
                status_code=404,
                detail=f"KMZ-Datei mit Hash {file_hash} nicht gefunden"
            )

        file_path = target_file["full_path"]

        # KMZ ist ein ZIP-Archiv mit KML drin
        kml_content = None
        with zipfile.ZipFile(file_path, 'r') as kmz:
            # Suche nach .kml Datei im Archiv
            kml_files = [f for f in kmz.namelist() if f.endswith('.kml')]

            if not kml_files:
                raise HTTPException(
                    status_code=400,
                    detail="Keine KML-Datei im KMZ-Archiv gefunden"
                )

            # Nimm die erste KML-Datei
            kml_filename = kml_files[0]
            with kmz.open(kml_filename) as kml_file:
                kml_content = kml_file.read().decode('utf-8')

        logger.info(f"KML aus KMZ extrahiert: {target_file['filename']}")

        return {
            "success": True,
            "filename": target_file["filename"],
            "revier": target_file["revier"],
            "kml_content": kml_content,
            "hash": file_hash
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Fehler beim Extrahieren der KML: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Extrahieren: {str(e)}"
        )


@app.post("/reviere/kmz/sync")
async def sync_reviere_kmz(client_hashes: List[str] = []):
    """
    Synchronisiert KMZ-Dateien zwischen Server und Client

    Args:
        client_hashes: Liste von Hashes, die der Client bereits hat

    Returns:
        Liste von Dateien, die aktualisiert werden müssen
    """
    try:
        server_files = scan_reviere_for_kmz()
        server_hashes = {f["hash"]: f for f in server_files}

        # Finde Dateien, die der Client noch nicht hat oder die aktualisiert wurden
        files_to_update = []
        for file_hash, file_info in server_hashes.items():
            if file_hash not in client_hashes:
                files_to_update.append(file_info)

        # Finde Dateien, die der Client hat, aber auf dem Server nicht mehr existieren
        files_to_delete = []
        for client_hash in client_hashes:
            if client_hash not in server_hashes:
                files_to_delete.append(client_hash)

        logger.info(f"Sync: {len(files_to_update)} zu aktualisieren, {len(files_to_delete)} zu löschen")

        return {
            "success": True,
            "files_to_update": files_to_update,
            "files_to_delete": files_to_delete,
            "total_server_files": len(server_files),
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Fehler beim Sync: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler beim Sync: {str(e)}"
        )


@app.get("/cameras/status")
async def get_cameras_with_status(days_back: int = 7, filter_by_polygon: bool = True):
    """
    Holt alle Kamera-Status-Dateien aus den Reviere-Ordnern
    und filtert sie optional nach Revier-Polygonen

    Args:
        days_back: Wie viele Tage zurück sollen Dateien gelesen werden (default: 7)
        filter_by_polygon: Nur Kameras innerhalb der Revier-Polygone zeigen (default: True)

    Returns:
        Liste von Kamera-Status-Objekten mit GPS-Positionen
    """
    try:
        logger.info(f"Lade Kamera-Status (days_back={days_back}, filter_by_polygon={filter_by_polygon})")

        # Lese alle Status-Dateien
        cameras = get_camera_status_files(
            reviere_base_dir="/mnt/synology/Reviere",
            days_back=days_back
        )

        logger.info(f"{len(cameras)} Kamera-Status-Dateien gefunden")

        # Falls Polygon-Filter aktiviert
        if filter_by_polygon:
            # Lade KML-Polygone aus Reviere-Ordner
            polygons = {}

            try:
                reviere_dir = Path("/home/wildkamera/Reviere")
                if reviere_dir.exists():
                    for kmz_file in reviere_dir.glob("*.kmz"):
                        revier_name = kmz_file.stem

                        # Extract KML from KMZ und parse Koordinaten
                        try:
                            with zipfile.ZipFile(str(kmz_file), 'r') as z:
                                # Suche .kml Datei in KMZ
                                kml_files = [f for f in z.namelist() if f.endswith('.kml')]
                                if kml_files:
                                    kml_content = z.read(kml_files[0]).decode('utf-8')

                                    # Parse KML für Polygon-Koordinaten (vereinfacht)
                                    # Suche <coordinates> Tags
                                    import xml.etree.ElementTree as ET
                                    root = ET.fromstring(kml_content)

                                    # Namespace handling
                                    ns = {'kml': 'http://www.opengis.net/kml/2.2'}
                                    coords_elements = root.findall('.//kml:coordinates', ns)

                                    if not coords_elements:
                                        # Versuche ohne Namespace
                                        coords_elements = root.findall('.//coordinates')

                                    if coords_elements:
                                        # Nehme erstes Polygon
                                        coords_text = coords_elements[0].text.strip()
                                        # Parse: lng,lat,alt lng,lat,alt ...
                                        polygon_coords = []
                                        for point in coords_text.split():
                                            parts = point.split(',')
                                            if len(parts) >= 2:
                                                lng, lat = float(parts[0]), float(parts[1])
                                                polygon_coords.append((lat, lng))

                                        if polygon_coords:
                                            polygons[revier_name] = polygon_coords
                                            logger.info(f"Polygon für {revier_name} geladen: {len(polygon_coords)} Punkte")

                        except Exception as e:
                            logger.warning(f"Fehler beim Laden von {kmz_file.name}: {e}")

                logger.info(f"{len(polygons)} Revier-Polygone geladen")

                # Filtere Kameras
                cameras = filter_cameras_in_polygons(cameras, polygons)

            except Exception as e:
                logger.error(f"Fehler beim Laden der Polygone: {e}")

        return {
            "success": True,
            "cameras": cameras,
            "count": len(cameras),
            "filtered_by_polygon": filter_by_polygon,
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        logger.error(f"Fehler beim Laden der Kamera-Status: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Fehler: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    # Server starten
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
