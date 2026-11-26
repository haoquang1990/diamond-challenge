import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthGate } from './ui/auth-gate';
import { listenForInstallPrompt } from './ui/install-guide';
import './ui/styles.css';

// Story 053: keep Chrome's install prompt for the "Cài app" button in Cài đặt.
listenForInstallPrompt();

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('#root element missing from index.html');

createRoot(rootElement).render(
  <StrictMode>
    <AuthGate />
  </StrictMode>,
);

// PWA: cache the app shell for offline use (public/sw.js). Production only, so
// the dev server is never served stale files. The relative URL keeps the
// worker's scope at the deploy subpath (e.g. GitHub Pages /<repo>/).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error: unknown) => {
      console.warn('[pwa] service worker registration failed', error);
    });
  });
}
