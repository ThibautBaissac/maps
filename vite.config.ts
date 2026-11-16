import { defineConfig, type Plugin } from 'vite';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATALOGUE, catalogueProblems, PAGES_DIR, type CatalogueMap } from './src/catalogue.ts';

const root = fileURLToPath(new URL('.', import.meta.url));

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);

function pageHtml(map: CatalogueMap): string {
  const { title, place, styleDef: { label: styleLabel } } = map;
  return `<!doctype html>
<!-- Generated from src/registry.ts by vite.config.ts: do not edit. -->
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)} · ${esc(place.district)} — ${esc(styleLabel)}</title>
    <meta name="description" content="Plan illustré de ${esc(title)} (${esc(place.district)}), style ${esc(styleLabel.toLowerCase())}." />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/src/map-page.css" />
  </head>
  <body data-map="${esc(map.id)}" data-label="Plan illustré : ${esc(title)}, ${esc(place.district)}. Boutons de zoom, molette ou touches plus et moins pour zoomer ; glisser ou flèches pour déplacer.">
    <div id="stage"></div>
    <p id="map-summary" class="sr-only">Consultez le bouton Description pour le contenu textuel du plan.</p>
    <p class="loading" role="status">Chargement du plan…</p>
    <div class="map-tools">
      <a class="back" href="../../">← Toutes les cartes</a>
      <div class="map-actions">
        <div class="zoom-controls" role="group" aria-label="Zoom du plan">
          <button class="zoom-in" type="button" aria-label="Agrandir le plan (+)" disabled>+</button>
          <button class="zoom-out" type="button" aria-label="Réduire le plan (−)" disabled>−</button>
        </div>
        <button class="description-button" type="button" aria-haspopup="dialog" aria-controls="map-description" disabled>Description</button>
      </div>
    </div>
    <dialog id="map-description" aria-labelledby="description-title">
      <form method="dialog"><button autofocus>Fermer</button></form>
      <h1 id="description-title">Description du plan</h1>
      <div id="description-content"></div>
    </dialog>
    <small class="attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contributeurs OpenStreetMap</a></small>
    <script type="module" src="/src/map-page.ts"></script>
  </body>
</html>
`;
}

// Checks the registry and writes one HTML page per map; returns the build inputs.
// The registry is type-checked; whether each map's data exists and matches its place
// is only known here (src/catalogue.ts). A problem stops the build; in development the
// map is skipped with a warning so the others keep working while data downloads.
function generatePages(strict: boolean): Record<string, string> {
  rmSync(new URL(PAGES_DIR, pathToFileURL(root)), { recursive: true, force: true }); // generated, git-ignored
  const input: Record<string, string> = { index: `${root}index.html` };
  const skipped = new Set<string>();
  for (const { id, message } of catalogueProblems(readPublicJson)) {
    if (strict) throw new Error(`registry: ${message}`);
    console.warn(`\x1b[33m[registry] skipped: ${message}\x1b[0m`);
    skipped.add(id);
  }
  for (const m of CATALOGUE) {
    if (skipped.has(m.id)) continue;
    if (!existsSync(`${root}public/${m.paths.vignette}`)) {
      console.warn(`\x1b[33m[registry] ${m.id}: no gallery picture; run npm run vignettes -- ${m.id} with the dev server up\x1b[0m`);
    }
    const dir = `${root}${m.paths.page}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}index.html`, pageHtml(m));
    input[m.id] = `${dir}index.html`;
  }
  return input;
}

// Parsed public/<path>; undefined when the file does not exist, null when it is not
// valid JSON (a download cut short): the catalogue reports both, naming the file.
function readPublicJson(path: string): unknown {
  const file = `${root}public/${path}`;
  if (!existsSync(file)) return undefined;
  try { return JSON.parse(readFileSync(file, 'utf8')) as unknown; } catch { return null; }
}

// In development, regenerate the pages when a data file appears, changes or disappears
// (the registry, places/index.ts and the styles index already restart the server).
const watchData = (): Plugin => ({
  name: 'watch-data',
  configureServer(server) {
    const dir = `${root}public/data/`;
    server.watcher.add(dir);
    const restart = (file: string): void => { if (file.startsWith(dir)) void server.restart(); };
    for (const ev of ['add', 'change', 'unlink'] as const) server.watcher.on(ev, restart);
  },
});

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site under /<repository>/.
  base: process.env['BASE_PATH'] ?? '/maps/',
  plugins: [watchData()],
  build: { rolldownOptions: { input: generatePages(command === 'build') } },
}));
