"""
Settings Manager für persistente Speicherung von Kamera-Einstellungen
"""
import json
import os
from typing import Dict, Optional, Any
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class SettingsManager:
    """
    Verwaltet die Persistenz von Kamera-Einstellungen
    """

    def __init__(self, settings_file: str = "camera_settings.json"):
        """
        Initialisiert den Settings Manager

        Args:
            settings_file: Pfad zur JSON-Datei für Einstellungen
        """
        self.settings_file = settings_file
        self.settings: Dict[str, Any] = {}
        self._load_settings()

    def _load_settings(self):
        """Lädt Einstellungen aus der JSON-Datei"""
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, 'r', encoding='utf-8') as f:
                    self.settings = json.load(f)
                logger.info(f"Einstellungen geladen aus {self.settings_file}")
            else:
                logger.info("Keine gespeicherten Einstellungen gefunden, starte mit leeren Einstellungen")
                self.settings = {}
        except Exception as e:
            logger.error(f"Fehler beim Laden der Einstellungen: {e}")
            self.settings = {}

    def _save_settings(self):
        """Speichert Einstellungen in die JSON-Datei"""
        try:
            with open(self.settings_file, 'w', encoding='utf-8') as f:
                json.dump(self.settings, f, indent=2, ensure_ascii=False)
            logger.info(f"Einstellungen gespeichert in {self.settings_file}")
        except Exception as e:
            logger.error(f"Fehler beim Speichern der Einstellungen: {e}")
            raise

    def save_camera_settings(self, camera_id: str, settings: Dict[str, Any]) -> bool:
        """
        Speichert Einstellungen für eine bestimmte Kamera

        Args:
            camera_id: ID der Kamera
            settings: Dictionary mit Einstellungen

        Returns:
            True bei Erfolg
        """
        try:
            if "cameras" not in self.settings:
                self.settings["cameras"] = {}

            # Timestamp hinzufügen
            settings["last_updated"] = datetime.now().isoformat()

            # Einstellungen für Kamera speichern
            self.settings["cameras"][camera_id] = settings

            # Letzte verwendete Kamera merken
            self.settings["last_camera_id"] = camera_id

            self._save_settings()
            return True

        except Exception as e:
            logger.error(f"Fehler beim Speichern der Kamera-Einstellungen: {e}")
            return False

    def get_camera_settings(self, camera_id: str) -> Optional[Dict[str, Any]]:
        """
        Holt Einstellungen für eine bestimmte Kamera

        Args:
            camera_id: ID der Kamera

        Returns:
            Dictionary mit Einstellungen oder None
        """
        try:
            if "cameras" in self.settings and camera_id in self.settings["cameras"]:
                return self.settings["cameras"][camera_id]
            return None
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Kamera-Einstellungen: {e}")
            return None

    def get_last_settings(self) -> Optional[Dict[str, Any]]:
        """
        Holt die zuletzt verwendeten Einstellungen

        Returns:
            Dictionary mit letzten Einstellungen oder None
        """
        try:
            if "last_camera_id" in self.settings:
                last_camera_id = self.settings["last_camera_id"]
                return {
                    "camera_id": last_camera_id,
                    "settings": self.get_camera_settings(last_camera_id)
                }

            # Fallback: Erste verfügbare Kamera
            if "cameras" in self.settings and len(self.settings["cameras"]) > 0:
                camera_id = list(self.settings["cameras"].keys())[0]
                return {
                    "camera_id": camera_id,
                    "settings": self.settings["cameras"][camera_id]
                }

            return None
        except Exception as e:
            logger.error(f"Fehler beim Abrufen der letzten Einstellungen: {e}")
            return None

    def get_all_cameras(self) -> Dict[str, Dict[str, Any]]:
        """
        Holt alle gespeicherten Kamera-Einstellungen

        Returns:
            Dictionary mit allen Kameras und ihren Einstellungen
        """
        return self.settings.get("cameras", {})

    def delete_camera_settings(self, camera_id: str) -> bool:
        """
        Löscht Einstellungen für eine bestimmte Kamera

        Args:
            camera_id: ID der Kamera

        Returns:
            True bei Erfolg
        """
        try:
            if "cameras" in self.settings and camera_id in self.settings["cameras"]:
                del self.settings["cameras"][camera_id]

                # Wenn das die letzte Kamera war, auch last_camera_id löschen
                if self.settings.get("last_camera_id") == camera_id:
                    if len(self.settings.get("cameras", {})) > 0:
                        # Setze auf eine andere Kamera
                        self.settings["last_camera_id"] = list(self.settings["cameras"].keys())[0]
                    else:
                        # Keine Kameras mehr vorhanden
                        if "last_camera_id" in self.settings:
                            del self.settings["last_camera_id"]

                self._save_settings()
                return True

            return False
        except Exception as e:
            logger.error(f"Fehler beim Löschen der Kamera-Einstellungen: {e}")
            return False

    def save_sms_log(self, log_entry: Dict[str, Any]) -> bool:
        """
        Speichert einen SMS-Log-Eintrag

        Args:
            log_entry: Dictionary mit Log-Informationen

        Returns:
            True bei Erfolg
        """
        try:
            if "sms_log" not in self.settings:
                self.settings["sms_log"] = []

            # Timestamp hinzufügen
            log_entry["timestamp"] = datetime.now().isoformat()

            # Log-Eintrag hinzufügen
            self.settings["sms_log"].append(log_entry)

            # Nur die letzten 100 Einträge behalten
            if len(self.settings["sms_log"]) > 100:
                self.settings["sms_log"] = self.settings["sms_log"][-100:]

            self._save_settings()
            return True

        except Exception as e:
            logger.error(f"Fehler beim Speichern des SMS-Logs: {e}")
            return False

    def get_sms_log(self, limit: int = 50) -> list:
        """
        Holt die letzten SMS-Log-Einträge

        Args:
            limit: Maximale Anzahl zurückzugebender Einträge

        Returns:
            Liste mit Log-Einträgen
        """
        try:
            log = self.settings.get("sms_log", [])
            return log[-limit:] if len(log) > limit else log
        except Exception as e:
            logger.error(f"Fehler beim Abrufen des SMS-Logs: {e}")
            return []

    def clear_sms_log(self) -> bool:
        """
        Löscht alle SMS-Log-Einträge

        Returns:
            True bei Erfolg
        """
        try:
            self.settings["sms_log"] = []
            self._save_settings()
            return True
        except Exception as e:
            logger.error(f"Fehler beim Löschen des SMS-Logs: {e}")
            return False
