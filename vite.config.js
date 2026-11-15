import { defineConfig } from 'vite';

export default defineConfig({
  json: { stringify: true },
  // The OSM data (~2 MB) is bundled on purpose: the page never fetches anything at load.
  build: { chunkSizeWarningLimit: 2500 },
});
