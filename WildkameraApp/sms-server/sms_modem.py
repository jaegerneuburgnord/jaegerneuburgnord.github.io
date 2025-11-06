"""
SMS Modem Klasse für USB-Modem-Kommunikation
Unterstützt AT-Kommandos für GSM-Modems
"""
import serial
import serial.tools.list_ports
import asyncio
import logging
import time
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)


class SmsModem:
    """
    Klasse zur Kommunikation mit einem USB-SMS-Modem über AT-Kommandos
    """

    def __init__(self, port: Optional[str] = None, baudrate: int = 115200, timeout: int = 10):
        """
        Initialisiert die SMS-Modem-Verbindung

        Args:
            port: Serieller Port (z.B. /dev/ttyUSB0), None für automatische Erkennung
            baudrate: Baudrate für die serielle Kommunikation
            timeout: Timeout für serielle Kommunikation in Sekunden
        """
        self.port = port
        self.baudrate = baudrate
        self.timeout = timeout
        self.serial_connection: Optional[serial.Serial] = None
        self.connected = False

    async def connect(self) -> bool:
        """
        Verbindet mit dem SMS-Modem

        Returns:
            True bei erfolgreicher Verbindung
        """
        try:
            # Automatische Port-Erkennung wenn kein Port angegeben
            if not self.port:
                self.port = self._auto_detect_port()
                if not self.port:
                    raise Exception("Kein USB-Modem gefunden")

            logger.info(f"Verbinde mit Modem auf Port {self.port}")

            # Serielle Verbindung öffnen
            self.serial_connection = serial.Serial(
                port=self.port,
                baudrate=self.baudrate,
                timeout=self.timeout,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE
            )

            # Warte kurz für Modem-Initialisierung
            await asyncio.sleep(1)

            # Teste Verbindung mit AT-Kommando
            if not await self._test_connection():
                raise Exception("Modem antwortet nicht auf AT-Kommandos")

            # Modem initialisieren
            await self._initialize_modem()

            self.connected = True
            logger.info("Erfolgreich mit Modem verbunden")
            return True

        except Exception as e:
            logger.error(f"Fehler beim Verbinden mit Modem: {e}")
            if self.serial_connection and self.serial_connection.is_open:
                self.serial_connection.close()
            raise

    async def disconnect(self):
        """Trennt die Verbindung zum Modem"""
        if self.serial_connection and self.serial_connection.is_open:
            self.serial_connection.close()
            self.connected = False
            logger.info("Modem-Verbindung getrennt")

    def is_connected(self) -> bool:
        """Prüft, ob das Modem verbunden ist"""
        return self.connected and self.serial_connection and self.serial_connection.is_open

    async def send_sms(self, phone_number: str, message: str) -> bool:
        """
        Sendet eine SMS über das Modem

        Args:
            phone_number: Zieltelefonnummer (z.B. +491234567890)
            message: SMS-Text

        Returns:
            True bei erfolgreichem Versand
        """
        if not self.is_connected():
            raise Exception("Modem ist nicht verbunden")

        try:
            logger.info(f"Sende SMS an {phone_number}")

            # SMS-Modus auf Text setzen
            await self._send_at_command("AT+CMGF=1")

            # Empfängernummer setzen
            response = await self._send_at_command(f'AT+CMGS="{phone_number}"', wait_for=">")

            if ">" not in response:
                raise Exception("Modem nicht bereit für SMS-Text")

            # SMS-Text senden (mit Ctrl+Z am Ende, ASCII 26)
            message_with_ctrl_z = message + chr(26)
            response = await self._send_at_command(
                message_with_ctrl_z,
                wait_for="OK",
                timeout=30  # Längerer Timeout für SMS-Versand
            )

            if "OK" in response or "+CMGS:" in response:
                logger.info(f"SMS erfolgreich an {phone_number} gesendet")
                return True
            else:
                logger.error(f"SMS-Versand fehlgeschlagen: {response}")
                return False

        except Exception as e:
            logger.error(f"Fehler beim Senden der SMS: {e}")
            return False

    async def get_modem_info(self) -> Dict[str, str]:
        """
        Holt Informationen über das Modem

        Returns:
            Dictionary mit Modem-Informationen
        """
        info = {}

        try:
            # Hersteller
            response = await self._send_at_command("AT+CGMI")
            info["manufacturer"] = self._parse_response(response)

            # Modell
            response = await self._send_at_command("AT+CGMM")
            info["model"] = self._parse_response(response)

            # Seriennummer
            response = await self._send_at_command("AT+CGSN")
            info["serial"] = self._parse_response(response)

            # Signalstärke
            response = await self._send_at_command("AT+CSQ")
            info["signal_strength"] = self._parse_response(response)

            # Netzwerkregistrierung
            response = await self._send_at_command("AT+CREG?")
            info["network_registration"] = self._parse_response(response)

            # SIM-Status
            response = await self._send_at_command("AT+CPIN?")
            info["sim_status"] = self._parse_response(response)

        except Exception as e:
            logger.error(f"Fehler beim Abrufen der Modem-Informationen: {e}")

        return info

    async def _test_connection(self) -> bool:
        """Testet die Verbindung mit einem einfachen AT-Kommando"""
        try:
            response = await self._send_at_command("AT")
            return "OK" in response
        except:
            return False

    async def _initialize_modem(self):
        """Initialisiert das Modem mit grundlegenden Einstellungen"""
        logger.info("Initialisiere Modem...")

        # Echo ausschalten
        await self._send_at_command("ATE0")

        # SMS-Format auf Text setzen (1 = Text, 0 = PDU)
        await self._send_at_command("AT+CMGF=1")

        # Zeichensatz auf GSM setzen
        await self._send_at_command("AT+CSCS=\"GSM\"")

        # Prüfe SIM-Status
        response = await self._send_at_command("AT+CPIN?")
        if "READY" not in response:
            logger.warning("SIM-Karte nicht bereit")

        # Warte auf Netzwerkregistrierung
        max_retries = 10
        for i in range(max_retries):
            response = await self._send_at_command("AT+CREG?")
            # +CREG: 0,1 oder +CREG: 0,5 bedeutet registriert
            if ",1" in response or ",5" in response:
                logger.info("Im Netzwerk registriert")
                break
            logger.info(f"Warte auf Netzwerkregistrierung... ({i+1}/{max_retries})")
            await asyncio.sleep(2)
        else:
            logger.warning("Netzwerkregistrierung nicht bestätigt")

        logger.info("Modem-Initialisierung abgeschlossen")

    async def _send_at_command(
        self,
        command: str,
        wait_for: str = "OK",
        timeout: int = 5
    ) -> str:
        """
        Sendet ein AT-Kommando an das Modem und wartet auf Antwort

        Args:
            command: AT-Kommando
            wait_for: String, auf den gewartet werden soll
            timeout: Timeout in Sekunden

        Returns:
            Antwort des Modems
        """
        if not self.serial_connection or not self.serial_connection.is_open:
            raise Exception("Serielle Verbindung nicht geöffnet")

        # Kommando senden
        command_bytes = (command + "\r\n").encode('utf-8')
        self.serial_connection.write(command_bytes)
        logger.debug(f"Gesendet: {command}")

        # Auf Antwort warten
        response = ""
        start_time = time.time()

        while time.time() - start_time < timeout:
            if self.serial_connection.in_waiting > 0:
                chunk = self.serial_connection.read(self.serial_connection.in_waiting)
                response += chunk.decode('utf-8', errors='ignore')

                # Prüfe ob erwartete Antwort enthalten ist
                if wait_for in response:
                    break

            await asyncio.sleep(0.1)

        logger.debug(f"Empfangen: {response}")

        if wait_for not in response:
            logger.warning(f"Timeout oder unerwartete Antwort: {response}")

        return response.strip()

    def _parse_response(self, response: str) -> str:
        """
        Extrahiert die relevante Information aus einer AT-Kommando-Antwort

        Args:
            response: Rohe Antwort vom Modem

        Returns:
            Geparste Antwort
        """
        lines = response.split('\n')
        for line in lines:
            line = line.strip()
            if line and line != "OK" and not line.startswith("AT"):
                return line
        return response.strip()

    def _auto_detect_port(self) -> Optional[str]:
        """
        Versucht automatisch einen passenden USB-Modem-Port zu finden

        Returns:
            Gefundener Port oder None
        """
        logger.info("Suche nach USB-Modems...")

        ports = serial.tools.list_ports.comports()

        # Typische Modem-Beschreibungen
        modem_keywords = [
            "modem", "gsm", "3g", "4g", "lte",
            "qualcomm", "huawei", "zte", "sierra",
            "usb serial", "ttyUSB", "ttyACM"
        ]

        for port in ports:
            port_info = f"{port.device} - {port.description} - {port.hwid}".lower()
            logger.debug(f"Gefundener Port: {port_info}")

            # Prüfe ob Port Modem-Keywords enthält
            for keyword in modem_keywords:
                if keyword in port_info:
                    logger.info(f"Mögliches Modem gefunden: {port.device}")
                    return port.device

        # Fallback: Ersten ttyUSB oder ttyACM Port verwenden (typisch unter Linux)
        for port in ports:
            if "ttyUSB" in port.device or "ttyACM" in port.device:
                logger.info(f"Verwende Port: {port.device}")
                return port.device

        logger.warning("Kein USB-Modem gefunden")
        return None
