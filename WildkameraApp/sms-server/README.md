# Wildkamera SMS Server

FastAPI-basierter Server zum Versenden von SMS über ein USB-angebundenes GSM-Modem unter Linux.

## Features

- SMS-Versand über USB-GSM-Modem
- RESTful API mit FastAPI
- Automatische Modem-Erkennung
- Batch-SMS-Versand
- Einstellungspersistenz
- CORS-Unterstützung für Web-Apps

## Voraussetzungen

- Linux-System (getestet auf Ubuntu/Debian)
- Python 3.8 oder höher
- USB-GSM-Modem (z.B. Huawei, ZTE, Sierra Wireless)
- SIM-Karte mit aktiviertem SMS-Dienst

## Installation

1. Repository klonen oder Dateien herunterladen

2. Python Virtual Environment erstellen (empfohlen):
```bash
python3 -m venv venv
source venv/bin/activate
```

3. Dependencies installieren:
```bash
pip install -r requirements.txt
```

4. USB-Modem anschließen und Berechtigungen setzen:
```bash
# Benutzer zur dialout-Gruppe hinzufügen (für Zugriff auf /dev/ttyUSB*)
sudo usermod -a -G dialout $USER

# Neuanmeldung erforderlich oder:
newgrp dialout

# Prüfen, welches Device das Modem ist:
ls -l /dev/ttyUSB*
# oder
dmesg | grep tty
```

## Nutzung

### Server starten

```bash
# Mit automatischer Modem-Erkennung
python main.py

# Oder mit uvicorn direkt
uvicorn main:app --host 0.0.0.0 --port 8000
```

Der Server läuft dann auf `http://localhost:8000`

### API-Dokumentation

Nach dem Start ist die interaktive API-Dokumentation verfügbar unter:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### Wichtige Endpoints

#### Status abfragen
```bash
curl http://localhost:8000/status
```

#### Verfügbare Ports auflisten
```bash
curl http://localhost:8000/modem/ports
```

#### Modem manuell konfigurieren
```bash
curl -X POST http://localhost:8000/modem/configure \
  -H "Content-Type: application/json" \
  -d '{
    "port": "/dev/ttyUSB0",
    "baudrate": 115200,
    "timeout": 10
  }'
```

#### SMS senden
```bash
curl -X POST http://localhost:8000/sms/send \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+491234567890",
    "message": "$03*1#1$",
    "camera_id": "camera_01"
  }'
```

#### Batch-SMS senden
```bash
curl -X POST http://localhost:8000/sms/send-batch \
  -H "Content-Type: application/json" \
  -d '[
    {
      "phone_number": "+491234567890",
      "message": "$03*1#1$",
      "camera_id": "camera_01"
    },
    {
      "phone_number": "+491234567891",
      "message": "$03*1#1$",
      "camera_id": "camera_02"
    }
  ]'
```

#### Letzte Einstellungen abrufen
```bash
curl http://localhost:8000/settings/last
```

#### Einstellungen speichern
```bash
curl -X POST http://localhost:8000/settings/save \
  -H "Content-Type: application/json" \
  -d '{
    "camera_id": "camera_01",
    "settings": {
      "captureMode": "Bild",
      "imageResolution": "12MP"
    }
  }'
```

## Systemd Service einrichten (optional)

Für automatischen Start beim Booten:

1. Service-Datei erstellen:
```bash
sudo nano /etc/systemd/system/wildkamera-sms.service
```

2. Inhalt:
```ini
[Unit]
Description=Wildkamera SMS Server
After=network.target

[Service]
Type=simple
User=ihr-benutzername
WorkingDirectory=/pfad/zum/sms-server
Environment="PATH=/pfad/zum/venv/bin"
ExecStart=/pfad/zum/venv/bin/python main.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

3. Service aktivieren:
```bash
sudo systemctl daemon-reload
sudo systemctl enable wildkamera-sms.service
sudo systemctl start wildkamera-sms.service
sudo systemctl status wildkamera-sms.service
```

## Troubleshooting

### Modem wird nicht erkannt
- Prüfen Sie, ob das Modem unter `/dev/ttyUSB*` oder `/dev/ttyACM*` erscheint
- Berechtigungen prüfen: `ls -l /dev/ttyUSB0`
- Kernel-Log prüfen: `dmesg | tail -n 50`

### SMS werden nicht gesendet
- Signalstärke prüfen (Endpoint: `/status`)
- SIM-Karte prüfen (PIN deaktivieren!)
- AT-Kommandos manuell testen:
```bash
minicom -D /dev/ttyUSB0
# Im minicom:
AT
AT+CPIN?
AT+CSQ
AT+CREG?
```

### Berechtigungsfehler
```bash
# Benutzer zur dialout-Gruppe hinzufügen
sudo usermod -a -G dialout $USER
# Danach neu anmelden oder:
newgrp dialout
```

## Unterstützte Modems

Getestet mit:
- Huawei E3131
- Huawei E173
- ZTE MF823
- Sierra Wireless MC7354

Die meisten USB-GSM-Modems mit AT-Kommando-Unterstützung sollten funktionieren.

## Sicherheitshinweise

- In Produktionsumgebungen CORS-Einstellungen anpassen
- HTTPS/TLS für öffentliche Deployments verwenden
- Firewall-Regeln entsprechend konfigurieren
- API-Authentifizierung hinzufügen (nicht im Basis-Setup enthalten)

## Lizenz

MIT
