import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app';
import { IndexedDbEventStore } from './data/indexeddb-event-store';
import './ui/styles.css';

const rootElement = document.getElementById('root');
if (rootElement === null) throw new Error('#root element missing from index.html');

createRoot(rootElement).render(
  <StrictMode>
    <App eventStore={new IndexedDbEventStore('diamond-challenge')} />
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
