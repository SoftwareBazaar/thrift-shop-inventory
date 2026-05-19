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

// Register Service Worker for PWA offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('✅ Service Worker registered:', registration.scope);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                console.log('🔄 New service worker available');
                // Optionally show update notification to user
              }
            });
          }
        });
      })
      .catch((error) => {
        console.error('❌ Service Worker registration failed:', error);
      });
  });

  // Listen for service worker updates
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('🔄 Service worker controller changed');
    // Optionally reload the page to use new service worker
    // window.location.reload();
  });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
