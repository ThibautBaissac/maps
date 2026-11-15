import { defineConfig, type Plugin } from 'vite';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parsePlace, type Place } from './src/place.ts';
import { MAPS, type MapEntry } from './src/registry.ts';
import { STYLES, isStyleKey } from './src/styles/index.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const PAGES = 'cartes'; // generated, git-ignored

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);

function pageHtml(map: MapEntry, place: Place, styleLabel: string): string {
  const title = map.title ?? place.name;
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
// The registry is type-checked, but the files it points to are only known here.
// A broken entry stops the build; in development it is skipped with a warning so the
// other maps keep working while a place's data is still downloading.
async function generatePages(strict: boolean): Promise<Record<string, string>> {
  rmSync(new URL(PAGES, pathToFileURL(root)), { recursive: true, force: true });
  const input: Record<string, string> = { index: `${root}index.html` };
  const seen = new Set<string>();
  const problem = (msg: string): void => {
    if (strict) throw new Error(`registry: ${msg}`);
    console.warn(`\x1b[33m[registry] skipped: ${msg}\x1b[0m`);
  };
  for (const m of MAPS) {
    if (!/^[a-z0-9-]+$/.test(m.id) || seen.has(m.id)) { problem(`invalid or duplicate id "${m.id}"`); continue; }
    seen.add(m.id);
    if (!isStyleKey(m.style)) { problem(`unknown style "${m.style}" (${m.id}); known: ${Object.keys(STYLES).join(', ')}`); continue; }
    const placeFile = `${root}places/${m.place}.ts`;
    if (!existsSync(placeFile)) { problem(`no file places/${m.place}.ts (${m.id})`); continue; }
    if (!existsSync(`${root}public/data/${m.place}.json`)) { problem(`no data for ${m.place} (${m.id}); run npm run fetch-data -- ${m.place}`); continue; }
    let place: Place;
    try {
      const mod = (await import(`${pathToFileURL(placeFile).href}?t=${Date.now()}`)) as { default?: unknown };
      place = parsePlace(mod.default, `places/${m.place}.ts`);
    } catch (err) {
      problem(err instanceof Error ? err.message : String(err));
      continue;
    }
    if (!existsSync(`${root}public/vignettes/${m.id}.webp`)) {
      console.warn(`\x1b[33m[registry] ${m.id}: no gallery picture; run npm run vignettes -- ${m.id} with the dev server up\x1b[0m`);
    }
    const dir = `${root}${PAGES}/${m.id}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/index.html`, pageHtml(m, place, STYLES[m.style].label));
    input[m.id] = `${dir}/index.html`;
  }
  return input;
}

// In development, regenerate the pages when a place file or a data file appears,
// changes or disappears (the registry and styles index already restart the server).
const watchPlaces = (): Plugin => ({
  name: 'watch-places',
  configureServer(server) {
    const dirs = [`${root}places/`, `${root}public/data/`];
    server.watcher.add(dirs);
    const restart = (file: string): void => { if (dirs.some((d) => file.startsWith(d))) void server.restart(); };
    for (const ev of ['add', 'change', 'unlink'] as const) server.watcher.on(ev, restart);
  },
});

export default defineConfig(async ({ command }) => ({
  // GitHub Pages serves the site under /<repository>/.
  base: process.env['BASE_PATH'] ?? '/maps/',
  plugins: [watchPlaces()],
  build: { rolldownOptions: { input: await generatePages(command === 'build') } },
}));
