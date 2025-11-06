"""
Flask Test Server für Wildkamera PWA
Hostet die PWA-Dateien und bietet einen einfachen Development-Server
"""
from flask import Flask, send_from_directory, jsonify, request
from flask_cors import CORS
import os
import logging

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Flask App erstellen
app = Flask(__name__)

# CORS aktivieren für lokale Entwicklung
CORS(app)

# Pfad zum PWA-Verzeichnis (ein Level höher)
PWA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

logger.info(f"PWA-Verzeichnis: {PWA_DIR}")


@app.route('/')
def index():
    """Serve die index.html"""
    return send_from_directory(PWA_DIR, 'index.html')


@app.route('/<path:filename>')
def serve_file(filename):
    """
    Serve alle statischen Dateien (JS, CSS, Icons, etc.)
    """
    try:
        return send_from_directory(PWA_DIR, filename)
    except Exception as e:
        logger.error(f"Fehler beim Laden von {filename}: {e}")
        return jsonify({"error": "Datei nicht gefunden"}), 404


@app.route('/icons/<path:filename>')
def serve_icon(filename):
    """Serve Icon-Dateien"""
    icons_dir = os.path.join(PWA_DIR, 'icons')
    return send_from_directory(icons_dir, filename)


@app.route('/health')
def health():
    """Health-Check Endpoint"""
    return jsonify({
        "status": "healthy",
        "service": "Wildkamera PWA Test Server",
        "version": "1.0.0"
    })


@app.route('/api/proxy', methods=['POST'])
def proxy_to_sms_server():
    """
    Optional: Proxy-Endpoint zum SMS-Server
    Nützlich wenn SMS-Server auf anderem Host läuft
    """
    try:
        # Hole SMS-Server-URL aus Request-Body
        data = request.get_json()
        target_url = data.get('target_url')
        payload = data.get('payload')

        if not target_url or not payload:
            return jsonify({
                "error": "target_url und payload erforderlich"
            }), 400

        # Hier könnte man requests verwenden um zum SMS-Server zu proxyen
        # Für jetzt geben wir nur eine Info zurück
        return jsonify({
            "message": "Proxy-Feature - verwenden Sie direkt die SMS-Server-URL",
            "hint": "Konfigurieren Sie die Server-URL in der App-Konfiguration"
        })

    except Exception as e:
        logger.error(f"Fehler beim Proxy: {e}")
        return jsonify({"error": str(e)}), 500


@app.errorhandler(404)
def not_found(e):
    """404 Error Handler"""
    logger.warning(f"404: {request.path}")
    return jsonify({
        "error": "Route nicht gefunden",
        "path": request.path
    }), 404


@app.errorhandler(500)
def internal_error(e):
    """500 Error Handler"""
    logger.error(f"500: {e}")
    return jsonify({
        "error": "Interner Server-Fehler",
        "details": str(e)
    }), 500


# Middleware für Request-Logging
@app.before_request
def log_request():
    """Loggt eingehende Requests"""
    logger.info(f"{request.method} {request.path} - {request.remote_addr}")


@app.after_request
def add_security_headers(response):
    """Fügt Sicherheits-Header hinzu"""
    # Content Security Policy für PWA
    response.headers['Content-Security-Policy'] = (
        "default-src 'self' https: 'unsafe-inline' 'unsafe-eval' data: blob:; "
        "connect-src 'self' https: http://localhost:* http://127.0.0.1:*;"
    )

    # Andere Security Headers
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    response.headers['X-XSS-Protection'] = '1; mode=block'

    return response


def get_network_ip():
    """Ermittelt die lokale Netzwerk-IP"""
    import socket
    try:
        # Verbindung zu einem externen Server aufbauen (muss nicht erreichbar sein)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


if __name__ == '__main__':
    # UTF-8 Encoding für Console setzen (Windows)
    import sys
    if sys.platform == 'win32':
        import codecs
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

    # Netzwerk-IP ermitteln
    network_ip = get_network_ip()

    print("=" * 60)
    print(">> Wildkamera PWA Test Server")
    print("=" * 60)
    print(f"\n[PWA] Zugriff auf die PWA:")
    print(f"   Lokal:        http://localhost:5000")
    print(f"   Netzwerk:     http://{network_ip}:5000")
    print(f"\n[API] Verfuegbare Endpoints:")
    print(f"   /                  - PWA Index")
    print(f"   /health           - Health Check")
    print(f"   /<filename>       - Statische Dateien")
    print(f"\n[INFO] Tipps:")
    print(f"   - PWA im Browser oeffnen: http://localhost:5000")
    print(f"   - Auf Mobilgeraet (gleiches Netzwerk): http://{network_ip}:5000")
    print(f"   - SMS-Server separat starten (Port 8000)")
    print(f"\n[STOP] Server stoppen: Ctrl+C")
    print("=" * 60)
    print()

    # Server starten
    app.run(
        host='0.0.0.0',  # Auf allen Interfaces lauschen
        port=5000,
        debug=True,      # Debug-Modus für Entwicklung
        threaded=True    # Multi-Threading aktivieren
    )
