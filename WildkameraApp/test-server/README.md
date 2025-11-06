# Flask Test Server für Wildkamera PWA

Ein einfacher Flask-Entwicklungsserver zum Hosten und Testen der Wildkamera PWA.

## Features

- 🚀 Hostet die komplette PWA
- 📱 Zugriff von Mobilgeräten im lokalen Netzwerk
- 🔄 CORS-Support für API-Kommunikation
- 📝 Request-Logging
- 🔒 Security-Headers
- ⚡ Hot-Reload im Debug-Modus

## Installation

### Voraussetzungen

- Python 3.8 oder höher
- pip

### Setup

```bash
# Ins Verzeichnis wechseln
cd WildkameraApp/test-server

# Virtual Environment erstellen (empfohlen)
python -m venv venv

# Virtual Environment aktivieren
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Dependencies installieren
pip install -r requirements.txt
```

## Verwendung

### Server starten

```bash
python app.py
```

Der Server läuft dann auf:
- **Lokal:** http://localhost:5000
- **Netzwerk:** http://[Ihre-IP]:5000

### Zugriff von verschiedenen Geräten

#### Desktop/Laptop

```
http://localhost:5000
```

#### Smartphone/Tablet (gleiches WLAN)

1. Netzwerk-IP vom Server-Terminal ablesen
2. Im Browser öffnen: `http://[Server-IP]:5000`
3. Beispiel: `http://192.168.1.100:5000`

## Gleichzeitiger Betrieb mit SMS-Server

### Terminal 1: SMS-Server (Port 8000)

```bash
cd WildkameraApp/sms-server
source venv/bin/activate  # Linux/Mac
python main.py
```

### Terminal 2: Test-Server (Port 5000)

```bash
cd WildkameraApp/test-server
source venv/bin/activate  # Linux/Mac
python app.py
```

### Verwendung

1. PWA öffnen: http://localhost:5000
2. In der PWA Server-URL konfigurieren: http://localhost:8000
3. Verbindung testen und SMS senden

## Verfügbare Endpoints

### PWA-Endpoints

| Endpoint | Beschreibung |
|----------|-------------|
| `/` | PWA Index-Seite |
| `/<filename>` | Statische Dateien (JS, CSS, etc.) |
| `/icons/<filename>` | Icon-Dateien |

### API-Endpoints

| Endpoint | Methode | Beschreibung |
|----------|---------|-------------|
| `/health` | GET | Health-Check |
| `/api/proxy` | POST | Proxy zum SMS-Server (optional) |

## Konfiguration

### Port ändern

In `app.py`:

```python
app.run(
    host='0.0.0.0',
    port=5000,  # Hier Port ändern
    debug=True
)
```

### Debug-Modus deaktivieren

```python
app.run(
    host='0.0.0.0',
    port=5000,
    debug=False  # Debug aus
)
```

## Netzwerk-Zugriff von Mobilgeräten

### Schritt-für-Schritt

1. **Firewall-Regel hinzufügen** (falls nötig)

   **Windows:**
   ```powershell
   # Als Administrator ausführen
   netsh advfirewall firewall add rule name="Flask PWA Server" dir=in action=allow protocol=TCP localport=5000
   ```

   **Linux:**
   ```bash
   sudo ufw allow 5000/tcp
   ```

2. **Server starten**
   ```bash
   python app.py
   ```

3. **Netzwerk-IP notieren**

   Die IP wird beim Start angezeigt, z.B.:
   ```
   Netzwerk: http://192.168.1.100:5000
   ```

4. **Auf Mobilgerät öffnen**

   - Gleiches WLAN wie Server verwenden
   - Browser öffnen
   - URL eingeben: `http://192.168.1.100:5000`

### Problemlösung

**Server nicht erreichbar vom Mobilgerät:**

1. Firewall prüfen
2. Beide Geräte im gleichen Netzwerk?
3. IP-Adresse korrekt?
4. Server läuft auf `0.0.0.0` (nicht `127.0.0.1`)?

**Netzwerk-IP herausfinden:**

**Windows:**
```cmd
ipconfig
```
Suche nach "IPv4-Adresse"

**Linux/Mac:**
```bash
ip addr show
# oder
ifconfig
```

## PWA-Features testen

### Installation testen

1. PWA im Browser öffnen
2. Browser bietet Installation an (Chrome/Edge)
3. "Zum Startbildschirm hinzufügen"

### Offline-Funktionalität

1. PWA öffnen
2. Service Worker registriert sich automatisch
3. Browser DevTools → Application → Service Workers
4. "Offline" aktivieren
5. App sollte weiterhin funktionieren

### KML-Upload testen

1. Karten-Icon klicken
2. "KML Upload" wählen
3. KML-Datei hochladen
4. Reviergrenzen werden angezeigt

### Server-Kommunikation testen

1. SMS-Server starten (Port 8000)
2. In PWA: Antennen-Icon → Server-URL eintragen
3. Verbindung testen
4. SMS-Kommando senden

## Produktiv-Deployment

⚠️ **Wichtig:** Dieser Server ist nur für Entwicklung/Testing gedacht!

Für Produktion verwenden Sie:

### Option 1: Gunicorn (Linux)

```bash
pip install gunicorn

gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Option 2: Nginx + Gunicorn

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 3: Statisches Hosting

Die PWA kann auch ohne Flask gehostet werden:

- **GitHub Pages**
- **Netlify**
- **Vercel**
- **Apache/Nginx** (static files)

## Logging

### Log-Level ändern

In `app.py`:

```python
logging.basicConfig(
    level=logging.DEBUG,  # DEBUG, INFO, WARNING, ERROR
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
```

### Logs in Datei schreiben

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('server.log'),
        logging.StreamHandler()  # Auch in Console
    ]
)
```

## Entwicklungs-Tipps

### Hot Reload

Flask lädt automatisch neu wenn Dateien geändert werden (im Debug-Modus).

PWA-Dateien werden bei jedem Request neu geladen (kein Caching im Debug-Modus).

### Browser-Caching deaktivieren

Chrome/Edge DevTools:
1. F12 → Network
2. "Disable cache" aktivieren
3. DevTools offen lassen

### Service Worker testen

1. DevTools → Application → Service Workers
2. "Update on reload" aktivieren
3. "Bypass for network" für Tests

## Struktur

```
test-server/
├── app.py              # Flask Server
├── requirements.txt    # Dependencies
└── README.md          # Diese Datei

../                    # PWA-Dateien (ein Level höher)
├── index.html
├── app.js
├── api-client.js
├── ...
```

## Troubleshooting

### Problem: Port bereits in Verwendung

**Lösung:**
```bash
# Port ändern in app.py oder anderen Prozess beenden

# Windows - Prozess finden:
netstat -ano | findstr :5000

# Linux - Prozess finden:
lsof -i :5000

# Prozess beenden:
kill [PID]
```

### Problem: Import-Fehler

**Lösung:**
```bash
# Virtual Environment aktivieren
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Dependencies neu installieren
pip install -r requirements.txt
```

### Problem: CORS-Fehler

**Lösung:**
CORS ist bereits aktiviert. Falls Probleme:
```python
# In app.py
CORS(app, resources={
    r"/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type"]
    }
})
```

## Erweiterte Features

### HTTPS-Support

```python
if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=5000,
        ssl_context='adhoc'  # Selbst-signiertes Zertifikat
    )
```

Requires: `pip install pyopenssl`

### Authentifizierung hinzufügen

```python
from flask import request
from functools import wraps

def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.headers.get('Authorization')
        if not auth or auth != 'Bearer YOUR_SECRET_TOKEN':
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated

@app.route('/api/protected')
@require_auth
def protected():
    return jsonify({"message": "Access granted"})
```

## Performance-Tipps

### Caching aktivieren

```python
from flask import make_response
from datetime import datetime, timedelta

@app.route('/static/<path:filename>')
def serve_with_cache(filename):
    response = make_response(send_from_directory(PWA_DIR, filename))

    # Cache für 1 Stunde
    expires = datetime.now() + timedelta(hours=1)
    response.headers['Cache-Control'] = 'public, max-age=3600'
    response.headers['Expires'] = expires.strftime('%a, %d %b %Y %H:%M:%S GMT')

    return response
```

### Compression aktivieren

```bash
pip install flask-compress
```

```python
from flask_compress import Compress

app = Flask(__name__)
Compress(app)
```

## Support

Bei Fragen oder Problemen:

1. Logs prüfen (Console-Output)
2. Browser DevTools → Console
3. Network-Tab für HTTP-Requests prüfen

## Lizenz

MIT
