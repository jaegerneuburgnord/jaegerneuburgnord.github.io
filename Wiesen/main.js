// Funktion zum Registrieren und Aktualisieren des Service Workers
function registerAndUpdateServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./service-worker.js')
        .then(registration => {
          console.log('Service Worker erfolgreich registriert mit Scope:', registration.scope);
          
          // Prüfen, ob ein Update verfügbar ist
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('Neuer Service Worker wird installiert');
            
            newWorker.addEventListener('statechange', () => {
              // Wenn ein neuer Service Worker installiert wurde und bereit ist
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('Neues Update verfügbar!');
                showUpdateNotification();
              }
            });
          });
        })
        .catch(error => {
          console.error('Service Worker Registrierung fehlgeschlagen:', error);
        });
      
      // Seite neu laden, wenn der Service Worker die Kontrolle übernimmt
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('Service Worker hat sich aktualisiert, Seite wird neu geladen');
          window.location.reload();
        }
      });
    }
  }
  
  // Update-Benachrichtigung anzeigen
  function showUpdateNotification() {
    // Existierende Benachrichtigung entfernen (falls vorhanden)
    const existingNotification = document.querySelector('.update-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // Neue Benachrichtigung erstellen
    const notification = document.createElement('div');
    notification.className = 'update-notification';
    notification.innerHTML = `
      <div class="update-message">
        <p>Eine neue Version der Wiesen-Karte ist verfügbar!</p>
        <button id="update-now">Jetzt aktualisieren</button>
      </div>
    `;
    
    document.body.appendChild(notification);
    
    // Update-Button-Klick-Handler
    document.getElementById('update-now').addEventListener('click', () => {
      console.log('Update wird ausgeführt...');
      // Service Worker mitteilen, dass er die Wartephase überspringen soll
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg.waiting) {
          reg.waiting.postMessage({ action: 'skipWaiting' });
        }
      });
      
      // Benachrichtigung entfernen
      notification.remove();
    });
  }
  
  // Einfache Funktion, um regelmäßig nach Updates zu prüfen
  function checkForUpdates() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration) {
          registration.update();
          console.log('Nach Updates gesucht...');
        }
      });
    }
  }
  
  // Service Worker registrieren, wenn die Seite geladen wird
  window.addEventListener('load', () => {
    registerAndUpdateServiceWorker();
    
    // Optional: Regelmäßig nach Updates suchen (alle 6 Stunden)
    setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
  });