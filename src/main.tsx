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
