import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { initializeOfflineSync } from './services/syncLocalStorage';

// APP VERSION - Increment this whenever you want to force ALL devices (especially mobile) to clear old cache/session
const APP_VERSION = '1.0.1'; // 1.0.1: Stall ID sync fix

// Initialize offline sync before rendering app
const startApp = async () => {
  // Check for version update to force cache clear
  const lastVersion = localStorage.getItem('app_version');
  if (lastVersion !== APP_VERSION) {
    console.log(`🔄 New App Version (${APP_VERSION}) detected. Clearing local data...`);

    // Clear Local Storage
    localStorage.clear();
    localStorage.setItem('app_version', APP_VERSION);

    // Clear IndexedDB
    try {
      const dbs = await window.indexedDB.databases();
      for (const db of dbs) {
        if (db.name) window.indexedDB.deleteDatabase(db.name);
      }
    } catch (e) { console.error('Error clearing DB on update', e); }

    console.log('✅ Local data cleared for version update.');
    window.location.reload(); // Reload once to start fresh
    return;
  }

  await initializeOfflineSync();
  console.log('[App] Offline sync initialized');

  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

startApp();

// Register Service Worker for PWA offline support with AUTO-UPDATE:
// new deployments activate immediately and the page reloads once so every
// device always runs the latest version without manual cache clearing.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);

        // If an updated worker is already waiting (e.g. app reopened), activate it now
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        // When a new version finishes installing, activate it immediately
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('🔄 New version installed, activating...');
                newWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });

        // Proactively check for new deployments: every 15 minutes and
        // whenever the app/tab regains focus (long-lived PWA sessions).
        const checkForUpdates = () => registration.update().catch(() => { });
        setInterval(checkForUpdates, 15 * 60 * 1000);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') checkForUpdates();
        });
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });

  // When the new service worker takes control, reload once to run the new code
  let hasReloadedForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hasReloadedForUpdate) return;
    hasReloadedForUpdate = true;
    console.log('🔄 New version active, reloading...');
    window.location.reload();
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
