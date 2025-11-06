"""
FastAPI Server für SMS-Versand über USB-Modem
Unterstützt Wildkamera SMS-Kommandos
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import logging
from datetime import datetime
import asyncio
import os
import shutil

from sms_modem import SmsModem
from settings_manager import SettingsManager

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


if __name__ == "__main__":
    import uvicorn

    # Server starten
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
