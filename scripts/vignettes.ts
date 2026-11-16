// Takes each localized map's gallery picture: public/vignettes/<locale>/<id>.webp.
// A portrait crop
// drawn by the map page itself (src/vignette.ts) in headless Chrome. Needs a running
// server: `npm run dev` (default address below) or `npm run preview -- --port 5173`.
// Usage: npm run vignettes [-- <map-id>…] [--locale fr|en|es] [--base http://localhost:5173/maps/]
// Chrome is looked up in the usual places; set CHROME to its path otherwise.
import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { CATALOGUE, findMap, type CatalogueMap } from '../src/catalogue.ts';
import { fail, message } from './cli.ts';
import { LOCALES, isLocale, type Locale } from '../src/i18n/index.ts';

const args = process.argv.slice(2);
const baseAt = args.indexOf('--base');
const base = baseAt >= 0 ? args.splice(baseAt, 2)[1] ?? fail('--base needs a URL') : 'http://localhost:5173/maps/';
const localeAt = args.indexOf('--locale');
const selected = localeAt >= 0 ? args.splice(localeAt, 2)[1] : undefined;
if (localeAt >= 0 && (!selected || !isLocale(selected))) fail(`--locale needs one of: ${LOCALES.join(', ')}`);
const locales: readonly Locale[] = selected && isLocale(selected) ? [selected] : LOCALES;
const maps: CatalogueMap[] = args.length
  ? args.map((id) => findMap(id) ?? fail(`Unknown map "${id}" (src/registry.ts)`))
  : [...CATALOGUE];

function findChrome(): string {
  const env = process.env['CHROME'];
  if (env) return env;
  const paths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ];
  const found = paths.find((p) => existsSync(p));
  if (found) return found;
  for (const cmd of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { return execFileSync('which', [cmd], { encoding: 'utf8' }).trim(); } catch { /* next */ }
  }
  return fail('Chrome not found: set CHROME to its executable.');
}

try {
  const r = await fetch(base);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
} catch (err) {
  fail(`No server at ${base} (${message(err)}): start one with npm run dev.`);
}

const chrome = findChrome();
const run = promisify(execFile);
const publicDir = new URL('../public/', import.meta.url);

for (const locale of locales) for (const map of maps) {
  const { id, paths } = findMap(map.id, locale)!;
  const url = new URL(`${paths.page}#vignette`, base).href;
  const { stdout } = await run(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--window-size=1600,1000', '--force-device-scale-factor=2',
    '--virtual-time-budget=30000', '--dump-dom', url,
  ], { maxBuffer: 256 * 1024 * 1024 });
  const src = /<output[^>]*id="vignette"[^>]*data-src="data:image\/webp;base64,([^"]+)"/.exec(stdout)?.[1];
  if (!src) fail(`${id}: no picture in the page (${url}); open it in a browser and read the console.`);
  const file = new URL(paths.vignette, publicDir);
  const bytes = Buffer.from(src, 'base64');
  await mkdir(new URL('.', file), { recursive: true });
  await writeFile(file, bytes);
  console.log(`public/${paths.vignette}  ${(bytes.length / 1024).toFixed(0)} Ko`);
}
