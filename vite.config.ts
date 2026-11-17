import { defineConfig, type Plugin } from 'vite';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CATALOGUE, catalogueProblems, mapsForLocale, PAGES_DIR } from './src/catalogue.ts';
import { DEFAULT_LOCALE, LOCALES, translationProblems } from './src/i18n/index.ts';

import { galleryHtml, pageHtml, sitemapXml } from './scripts/pages.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const configuredBase = process.env['BASE_PATH'] ?? '/maps/';
const base = configuredBase.endsWith('/') ? configuredBase : `${configuredBase}/`;
const repository = process.env['GITHUB_REPOSITORY'];
// SITE_URL is the full public site URL, including its deployment path.
const siteUrl = process.env['SITE_URL'] ?? (repository ? `https://${repository.split('/')[0]}.github.io${base}` : undefined);

function writePage(path: string, html: string): string {
  const dir = `${root}${path}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}index.html`, html);
  return `${dir}index.html`;
}

// Checks the registry and writes one HTML page per map; returns the build inputs.
// The registry is type-checked; whether each map's data exists and matches its place
// is only known here (src/catalogue.ts). A problem stops the build; in development the
// map is skipped with a warning so the others keep working while data downloads.
/** Maps whose pages were written by the last generatePages: the sitemap lists them. */
let published: string[] = [];

function generatePages(strict: boolean): Record<string, string> {
  const problems = translationProblems();
  if (problems.length) throw new Error(`translations:\n${problems.join('\n')}`);
  rmSync(new URL(PAGES_DIR, pathToFileURL(root)), { recursive: true, force: true }); // generated, git-ignored
  const input: Record<string, string> = { index: `${root}index.html` };
  const skipped = new Set<string>();
  for (const { id, message } of catalogueProblems(readPublicJson)) {
    if (strict) throw new Error(`registry: ${message}`);
    console.warn(`\x1b[33m[registry] skipped: ${message}\x1b[0m`);
    skipped.add(id);
  }
  for (const locale of LOCALES) {
    rmSync(new URL(`${locale}/${PAGES_DIR}`, pathToFileURL(root)), { recursive: true, force: true });
    input[locale] = writePage(`${locale}/`, galleryHtml(locale, base, siteUrl));
    for (const m of mapsForLocale(locale)) {
      if (skipped.has(m.id)) continue;
      if (!existsSync(`${root}public/${m.paths.vignette}`) || !existsSync(`${root}public/${m.paths.share}`)) {
        console.warn(`\x1b[33m[registry] ${m.id} (${locale}): no gallery or share picture; run npm run vignettes -- ${m.id} with the dev server up\x1b[0m`);
      }
      input[`${locale}-${m.id}`] = writePage(m.paths.page, pageHtml(m, locale, base, siteUrl));
    }
  }
  published = CATALOGUE.map((m) => m.id).filter((id) => !skipped.has(id));
  // Keep existing French URLs usable; their canonical URLs point to /fr/.
  for (const m of CATALOGUE) {
    if (!skipped.has(m.id)) input[m.id] = writePage(`${PAGES_DIR}/${m.id}/`, pageHtml(m, DEFAULT_LOCALE, base, siteUrl));
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

// The sitemap needs absolute URLs: without a public origin (local build) there is none.
const sitemap = (): Plugin => ({
  name: 'sitemap',
  apply: 'build',
  generateBundle() {
    if (siteUrl) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml(siteUrl, published) });
  },
});

const rootGallery = (): Plugin => ({
  name: 'root-gallery',
  transformIndexHtml: {
    order: 'pre',
    handler(html) { return html.includes('<!-- root-gallery -->') ? galleryHtml(DEFAULT_LOCALE, base, siteUrl) : html; },
  },
});

export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site under /<repository>/.
  base,
  plugins: [watchData(), rootGallery(), sitemap()],
  build: { rolldownOptions: { input: generatePages(command === 'build') } },
}));
