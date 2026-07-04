import os
import base64
import json

def encode_kmz_to_base64(input_dir="kmz_files"):
    """
    Liest alle KMZ-Dateien aus dem Eingabeverzeichnis,
    kodiert sie als Base64 und erstellt ein JSON-Snippet.
    """
    if not os.path.exists(input_dir):
        print(f"Fehler: Das Verzeichnis '{input_dir}' wurde nicht gefunden.")
        return None
    
    kmz_data = {}
    
    # Alle KMZ-Dateien im Verzeichnis durchgehen
    for filename in os.listdir(input_dir):
        if filename.lower().endswith('.kmz'):
            file_path = os.path.join(input_dir, filename)
            try:
                # KMZ-Datei einlesen
                with open(file_path, 'rb') as file:
                    file_content = file.read()
                
                # Datei als Base64 kodieren
                base64_content = base64.b64encode(file_content).decode('utf-8')
                
                # Name ohne .kmz-Endung als Schlüssel verwenden
                key = os.path.splitext(filename)[0]
                
                # Base64-String mit Datentyp-Präfix
                kmz_data[key] = f"data:application/vnd.google-earth.kmz;base64,{base64_content}"
                
                print(f"Datei '{filename}' erfolgreich kodiert.")
            
            except Exception as e:
                print(f"Fehler beim Kodieren von '{filename}': {str(e)}")
    
    if not kmz_data:
        print("Keine KMZ-Dateien gefunden oder alle Kodierungen sind fehlgeschlagen.")
        return None
    
    # JSON-Snippet erstellen
    json_snippet = "const kmzData = " + json.dumps(kmz_data, indent=2, ensure_ascii=False) + ";"
    
    # JSON-Snippet in Datei speichern
    output_file = "kmz_data.js"
    with open(output_file, 'w', encoding='utf-8') as file:
        file.write(json_snippet)
    
    print(f"\nJSON-Snippet wurde in '{output_file}' gespeichert.")
    print(f"Insgesamt wurden {len(kmz_data)} KMZ-Dateien kodiert.")
    
    return json_snippet

def main():
    print("KMZ zu Base64-JSON Konverter")
    print("============================")
    
    # Benutzerdefiniertes Verzeichnis abfragen
    default_dir = "kmz_files"
    dir_input = input(f"Eingabeverzeichnis (Standard: '{default_dir}'): ").strip()
    input_dir = dir_input if dir_input else default_dir
    
    # Dateien kodieren und JSON-Snippet erstellen
    json_snippet = encode_kmz_to_base64(input_dir)
    
    if json_snippet:
        print("\nKodierung abgeschlossen. Das JSON-Snippet kann jetzt in deine Webseite integriert werden.")
    else:
        print("\nDie Kodierung konnte nicht abgeschlossen werden.")

if __name__ == "__main__":
    main()