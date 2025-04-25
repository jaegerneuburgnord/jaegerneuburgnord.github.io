# Installationsanleitung für die Wildkamera-App-Erweiterungen

Diese Anleitung führt Sie durch die Schritte, um die vorgeschlagenen Erweiterungen in Ihre bestehende Wildkamera-App zu integrieren.

## 1. Neue Dateien erstellen

Erstellen Sie zunächst die folgenden neuen Dateien:

### 1.1 ui-extensions.js
Kopieren Sie den vollständigen Code aus der Datei "ui-extensions.js" in eine neue Datei mit demselben Namen im Hauptverzeichnis Ihrer App.

### 1.2 camera-settings.js
Kombinieren Sie den Code aus den Artefakten "camera-settings.js" und "camera-settings.js (Fortsetzung)" und speichern Sie ihn als "camera-settings.js" im Hauptverzeichnis.

### 1.3 sync-manager.js
Kopieren Sie den vollständigen Code aus der Datei "sync-manager.js" in eine neue Datei mit demselben Namen im Hauptverzeichnis.

### 1.4 styles-extensions.css
Kopieren Sie den vollständigen Code aus der Datei "styles-extensions.css" in eine neue Datei mit demselben Namen im Hauptverzeichnis.

## 2. Änderungen an bestehenden Dateien

### 2.1 index.html
Fügen Sie die folgenden Zeilen im `<head>`-Bereich Ihrer index.html hinzu, nach den bestehenden CSS- und JavaScript-Importen:

```html
<link rel="stylesheet" href="styles-extensions.css">
<script defer src="ui-extensions.js"></script>
<script defer src="camera-settings.js"></script>
<script defer src="sync-manager.js"></script>
```

### 2.2 app.js
In der Datei app.js müssen mehrere Änderungen vorgenommen werden:

1. **DOMContentLoaded-Event-Handler**
   - Ersetzen Sie den bestehenden `document.addEventListener('DOMContentLoaded', ...)` durch die neue Version aus der "app-js-modifications" Datei.

2. **Funktions-Ersetzungen**
   - Ersetzen Sie die folgenden Funktionen in app.js durch Verweise auf die Funktionen aus den neuen Modulen:
     - `openSettingsModal` (aus camera-settings.js)
     - `syncPendingSMS` (aus sync-manager.js)
     - `updateSmsPreview` (aus camera-settings.js)
     - `setupNetworkStatus` (aus sync-manager.js)

   Die genauen Änderungen sind in der Datei "app-js-modifications" dokumentiert.

## 3. Überprüfung der Installation

Nach der Installation der Erweiterungen sollten Sie folgende neue Funktionen in Ihrer App sehen:

1. **Filterfunktion für Kameras**: Eine Suchleiste und Filter-Chips oberhalb der Kameraliste
2. **Batch-Operationen**: Ein neuer Button in der oberen rechten Ecke zum Aktivieren des Batch-Modus
3. **Verbesserte Einstellungen**: Kameratyp-spezifische Optionen und eine verbesserte SMS-Vorschau
4. **Erweiterte Synchronisation**: Verbesserte visuelle Anzeigen für den Synchronisationsstatus
5. **Netzwerkstatus-Indikator**: Eine deutlichere Anzeige des Online/Offline-Status

## 4. Fehlerbehebung

Falls nach der Installation Probleme auftreten:

1. **Konsole prüfen**: Öffnen Sie die Browser-Konsole (F12) und prüfen Sie auf JavaScript-Fehler.
2. **Datei-Reihenfolge**: Stellen Sie sicher, dass die Skripte in der richtigen Reihenfolge geladen werden. Die Erweiterungsdateien sollten nach den Kerndateien geladen werden.
3. **Versionskonflikte**: Falls Sie lokale Änderungen an den bestehenden Funktionen vorgenommen haben, müssen Sie möglicherweise die neuen Funktionen an Ihre spezifischen Änderungen anpassen.

## 5. Weitere Anpassungen

Die vorgeschlagenen Erweiterungen können nach Bedarf weiter angepasst werden:

- **Farbschema**: Sie können das Farbschema in der styles-extensions.css anpassen.
- **Kameratypen**: Sie können die Funktionalitätsunterschiede zwischen den Kameratypen in camera-settings.js anpassen.
- **Batch-Operationen**: Sie können weitere Batch-Operationen in ui-extensions.js hinzufügen.
