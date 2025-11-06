# Wildkamera SMS-Steuerung - Neue Features

## Übersicht

Die Wildkamera-App wurde um folgende Features erweitert:

1. **FastAPI-Server für SMS-Versand** über USB-GSM-Modem (Linux)
2. **Kartendarstellung** mit Reviergrenzen
3. **KML-Datei-Unterstützung** mit Offline-Speicherung
4. **Settings-Synchronisation** zwischen App und Server
5. **Verstecktes Feature** für direkten SMS-Versand über Browser

---

## 1. Server-Setup (Linux)

### Voraussetzungen

- Linux-System (Ubuntu/Debian)
- Python 3.8+
- USB-GSM-Modem mit SIM-Karte

### Installation

```bash
cd WildkameraApp/sms-server

# Virtual Environment erstellen
python3 -m venv venv
source venv/bin/activate

# Dependencies installieren
pip install -r requirements.txt

# Benutzer zur dialout-Gruppe hinzufügen
sudo usermod -a -G dialout $USER
newgrp dialout

# Modem-Port finden
ls -l /dev/ttyUSB*
```

### Server starten

```bash
python main.py
```

Der Server läuft dann auf `http://localhost:8000`

### API-Dokumentation

Interaktive Dokumentation: `http://localhost:8000/docs`

---

## 2. App-Features

### 2.1 Server-Konfiguration

**Zugriff:** Klick auf das Antennen-Icon (⚡) im Header

**Funktionen:**
- Server-URL konfigurieren
- Verbindung testen
- Server-Status anzeigen (Modem-Verbindung)
- SMS-Versand-Modus wählen

**Standard-URL:** `http://localhost:8000`

### 2.2 Kartendarstellung

**Zugriff:** Klick auf das Karten-Icon (🗺️) im Header

**Funktionen:**
- Anzeige von Reviergrenzen aus KML-Dateien
- Eigene Position anzeigen
- KML-Dateien hochladen
- Synchronisation mit Server
- Offline-Verfügbarkeit

**Verwendung:**

1. KML-Datei vorbereiten (z.B. mit Google Earth erstellt)
2. Auf "KML Upload" klicken
3. Datei auswählen
4. Reviergrenzen werden automatisch angezeigt

**Offline-Funktionalität:**
- KML-Dateien werden lokal in IndexedDB gespeichert
- Karte funktioniert auch ohne Internet (OpenStreetMap-Tiles werden gecacht)
- Beim nächsten Online-Sein werden Änderungen synchronisiert

### 2.3 SMS-Versand über Server-API

**Standard-Modus:**
- SMS werden über den FastAPI-Server versendet
- Server verwendet USB-GSM-Modem
- Feedback über Erfolg/Misserfolg wird angezeigt

**Vorteile:**
- Zuverlässiger Versand
- Zentrale Verwaltung
- SMS-Log auf dem Server
- Unterstützung für Batch-Versand

### 2.4 Verstecktes Feature: Direkter SMS-Versand

**Aktivierung:**
- 10x auf den Header klicken
- Toast-Nachricht bestätigt die Aktivierung
- Option erscheint in der Server-Konfiguration

**Verwendung:**
- In Server-Konfiguration "Direkter Browser-SMS" wählen
- SMS werden über Browser-APIs versendet (sms:// URL-Schema)
- Nützlich als Fallback wenn Server nicht erreichbar

**Hinweis:** Diese Funktion öffnet die Standard-SMS-App des Geräts

---

## 3. API-Endpoints

### SMS-Versand

```bash
# Einzelne SMS senden
POST /sms/send
{
  "phone_number": "+491234567890",
  "message": "$03*1#1$",
  "camera_id": "camera_01"
}

# Batch-SMS senden
POST /sms/send-batch
[
  {"phone_number": "+49...", "message": "...", "camera_id": "..."},
  {"phone_number": "+49...", "message": "...", "camera_id": "..."}
]
```

### Einstellungen

```bash
# Einstellungen speichern
POST /settings/save
{
  "camera_id": "camera_01",
  "settings": {"captureMode": "Bild", "imageResolution": "12MP"}
}

# Letzte Einstellungen abrufen
GET /settings/last

# Spezifische Kamera-Einstellungen
GET /settings/camera/{camera_id}

# SMS-Log abrufen
GET /settings/sms-log?limit=50
```

### KML-Verwaltung

```bash
# KML-Datei hochladen
POST /kml/upload
Content-Type: multipart/form-data
file: [KML-Datei]
name: "revier_nord" (optional)

# KML-Dateien auflisten
GET /kml/list

# KML-Datei herunterladen
GET /kml/download/{filename}

# KML-Datei löschen
DELETE /kml/delete/{filename}
```

### Modem-Verwaltung

```bash
# Verfügbare Ports auflisten
GET /modem/ports

# Modem konfigurieren
POST /modem/configure
{
  "port": "/dev/ttyUSB0",
  "baudrate": 115200,
  "timeout": 10
}

# Status abfragen
GET /status
```

---

## 4. Datenbank-Schema (IndexedDB)

### Object Stores

1. **cameras** - Kamera-Informationen
   - KeyPath: `id`
   - Indices: `name`, `phone`

2. **settings** - Kamera-Einstellungen
   - KeyPath: `cameraId`

3. **pending-sms** - Ausstehende SMS (Offline-Queue)
   - KeyPath: `id` (autoIncrement)
   - Indices: `cameraId`, `timestamp`

4. **kmlFiles** - KML-Dateien (neu)
   - KeyPath: `filename`
   - Indices: `filename`, `uploaded`
   - Felder: `content`, `size`, `syncedToServer`

---

## 5. Workflow-Beispiele

### Workflow 1: SMS über Server senden

1. Server auf Linux-Rechner starten
2. App öffnen
3. Server-Konfiguration öffnen
4. Server-URL eintragen und testen
5. Konfiguration speichern
6. Kamera auswählen und Einstellungen konfigurieren
7. SMS senden - wird über Server-API verarbeitet
8. Erfolgsmeldung wird angezeigt

### Workflow 2: Reviergrenzen anzeigen

1. KML-Datei mit Google Earth erstellen
2. In App Karten-Icon klicken
3. "KML Upload" wählen
4. Datei hochladen
5. Reviergrenzen werden auf Karte angezeigt
6. Position bestimmen mit "Meine Position"
7. KML wird lokal gespeichert für Offline-Nutzung

### Workflow 3: Offline-Verwendung

1. KML-Dateien vorher hochladen (online)
2. Internet-Verbindung trennen
3. App öffnet weiterhin
4. Karte zeigt gespeicherte Reviergrenzen
5. SMS-Kommandos werden in Queue gespeichert
6. Bei nächster Online-Verbindung automatisch synchronisiert

---

## 6. Troubleshooting

### Problem: Server nicht erreichbar

**Lösung:**
- Firewall-Einstellungen prüfen
- Server-URL in App-Konfiguration korrekt?
- Server läuft? (`curl http://localhost:8000/status`)

### Problem: Modem wird nicht erkannt

**Lösung:**
```bash
# Modem-Gerät prüfen
ls -l /dev/ttyUSB*
dmesg | grep tty

# Berechtigungen prüfen
groups  # dialout sollte dabei sein

# Manuell konfigurieren über API
curl -X POST http://localhost:8000/modem/configure \
  -H "Content-Type: application/json" \
  -d '{"port": "/dev/ttyUSB0", "baudrate": 115200}'
```

### Problem: SMS werden nicht versendet

**Lösung:**
- SIM-Karte hat PIN deaktiviert?
- Signalstärke ausreichend? (Status-Endpoint prüfen)
- Modem unterstützt AT-Kommandos?

### Problem: KML-Dateien werden nicht angezeigt

**Lösung:**
- Browser-Console öffnen und Fehler prüfen
- KML-Datei-Format korrekt?
- IndexedDB-Quota nicht überschritten?

---

## 7. Sicherheitshinweise

### Produktion

- **CORS-Einstellungen** in `main.py` anpassen (nicht `allow_origins=["*"]`)
- **HTTPS/TLS** verwenden für öffentliche Deployments
- **Firewall-Regeln** konfigurieren
- **API-Authentifizierung** implementieren (Bearer Token)
- **Rate Limiting** hinzufügen

### Beispiel mit HTTPS

```python
# In main.py
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8443,
        ssl_keyfile="/path/to/key.pem",
        ssl_certfile="/path/to/cert.pem"
    )
```

---

## 8. Entwicklung & Erweiterungen

### Neue Features hinzufügen

**Server:**
1. Endpoint in `main.py` hinzufügen
2. Dokumentation mit Pydantic Models
3. Fehlerbehandlung implementieren

**App:**
1. API-Methode in `api-client.js` hinzufügen
2. UI in `index.html` erweitern
3. Event-Handler registrieren

### Testing

**Server:**
```bash
# Interaktive API-Dokumentation
http://localhost:8000/docs

# Manual testing mit curl
curl -X POST http://localhost:8000/sms/send \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+49...", "message": "test"}'
```

**App:**
- Browser DevTools Console
- Network-Tab für API-Calls
- Application-Tab für IndexedDB

---

## 9. Architektur-Übersicht

```
┌─────────────────────────────────────────────┐
│           Wildkamera PWA (Browser)          │
│                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │   UI     │  │ IndexedDB│  │  Service │ │
│  │Components│  │  (KML,   │  │  Worker  │ │
│  │          │  │Settings) │  │          │ │
│  └────┬─────┘  └────┬─────┘  └──────────┘ │
│       │             │                       │
│  ┌────▼─────────────▼────────────────────┐ │
│  │      api-client.js                     │ │
│  │    sms-manager.js, kml-manager.js     │ │
│  └────────────────┬───────────────────────┘ │
│                   │                          │
└───────────────────┼──────────────────────────┘
                    │ HTTP/REST
                    ▼
      ┌─────────────────────────────┐
      │   FastAPI Server (Linux)    │
      │                             │
      │  ┌──────────┐  ┌─────────┐ │
      │  │ Settings │  │   KML   │ │
      │  │ Manager  │  │ Storage │ │
      │  └──────────┘  └─────────┘ │
      │                             │
      │  ┌──────────────────────┐  │
      │  │   SMS Modem Module   │  │
      │  └──────────┬───────────┘  │
      └─────────────┼──────────────┘
                    │ Serial/USB
                    ▼
            ┌────────────────┐
            │  GSM Modem     │
            │  (USB)         │
            └────────────────┘
```

---

## 10. Lizenz & Credits

- **Leaflet.js** für Kartendarstellung (BSD-2-Clause)
- **Materialize CSS** für UI-Design (MIT)
- **FastAPI** für Server-Backend (MIT)
- **PySerial** für Modem-Kommunikation (BSD)

---

## Support

Bei Problemen oder Fragen:
1. API-Dokumentation konsultieren (`/docs`)
2. Browser-Console auf Fehler prüfen
3. Server-Logs prüfen
4. Issue auf GitHub erstellen

Happy Hunting! 🦌
