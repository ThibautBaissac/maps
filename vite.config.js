import { defineConfig } from 'vite';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { MAPS } from './src/registry.js';
import { STYLES } from './src/styles/index.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const PAGES = 'cartes'; // generated, git-ignored

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function pageHtml(map, place, style) {
  const title = map.title ?? place.name;
  return `<!doctype html>
<!-- Generated from src/registry.js by vite.config.js: do not edit. -->
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)} · ${esc(place.district)} — ${esc(style.label)}</title>
    <meta name="description" content="Plan illustré de ${esc(title)} (${esc(place.district)}), style ${esc(style.label.toLowerCase())}." />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/src/map-page.css" />
  </head>
  <body data-map="${esc(map.id)}" data-label="Plan illustré : ${esc(title)}, ${esc(place.district)}. Molette ou touches plus et moins pour zoomer, glisser ou flèches pour déplacer.">
    <div id="stage"></div>
    <p class="loading" role="status">Chargement du plan…</p>
    <a class="back" href="../../">← Toutes les cartes</a>
    <small class="attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contributeurs OpenStreetMap</a></small>
    <script type="module" src="/src/map-page.js"></script>
  </body>
</html>
`;
}

// Checks the registry and writes one HTML page per map; returns the build inputs.
// A broken entry stops the build; in development it is skipped with a warning so the
// other maps keep working while a place's data is still downloading.
async function generatePages(strict) {
  rmSync(new URL(PAGES, pathToFileURL(root)), { recursive: true, force: true });
  const input = { index: `${root}index.html` };
  const seen = new Set();
  const problem = (msg) => {
    if (strict) throw new Error(`registry: ${msg}`);
    console.warn(`\x1b[33m[registry] skipped: ${msg}\x1b[0m`);
  };
  for (const m of MAPS) {
    if (!/^[a-z0-9-]+$/.test(m.id ?? '') || seen.has(m.id)) { problem(`invalid or duplicate id "${m.id}"`); continue; }
    seen.add(m.id);
    const style = STYLES[m.style];
    if (!style) { problem(`unknown style "${m.style}" (${m.id}); known: ${Object.keys(STYLES).join(', ')}`); continue; }
    const placeFile = `${root}places/${m.place}.js`;
    if (!existsSync(placeFile)) { problem(`no file places/${m.place}.js (${m.id})`); continue; }
    if (!existsSync(`${root}public/data/${m.place}.json`)) { problem(`no data for ${m.place} (${m.id}); run npm run fetch-data -- ${m.place}`); continue; }
    const place = (await import(`${pathToFileURL(placeFile).href}?t=${Date.now()}`)).default;
    const dir = `${root}${PAGES}/${m.id}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/index.html`, pageHtml(m, place, style));
    input[m.id] = `${dir}/index.html`;
  }
  return input;
}

// In development, regenerate the pages when a place file or a data file appears,
// changes or disappears (the registry and styles index already restart the server).
const watchPlaces = () => ({
  name: 'watch-places',
  configureServer(server) {
    const dirs = [`${root}places/`, `${root}public/data/`];
    server.watcher.add(dirs);
    const restart = (file) => { if (dirs.some((d) => file.startsWith(d))) server.restart(); };
    for (const ev of ['add', 'change', 'unlink']) server.watcher.on(ev, restart);
  },
});

export default defineConfig(async ({ command }) => ({
  // GitHub Pages serves the site under /<repository>/.
  base: process.env.BASE_PATH ?? '/maps/',
  plugins: [watchPlaces()],
  build: { rolldownOptions: { input: await generatePages(command === 'build') } },
}));
