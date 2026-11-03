import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` emits relative asset URLs so the build works on GitHub Pages subpaths.
export default defineConfig({
  base: './',
  plugins: [react()],
});
