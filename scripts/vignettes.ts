// Takes each localized map's pictures: public/vignettes/<locale>/<id>.webp, the gallery's
// portrait crop, and <id>.jpg, the 1200×630 picture of a shared link. Both are
// drawn by the map page itself (src/vignette.ts) in headless Chrome. Needs a running
// server: `npm run dev` (default address below) or `npm run preview -- --port 5173`.
// Usage: npm run vignettes [-- <map-id>…] [--missing] [--locale <locale>] [--jobs <n>] [--base http://localhost:5173/maps/]
//   --missing  only the versions without both pictures (what the build refuses)
//   --jobs     Chrome instances at once (default: half the processors, at most 4)
// Chrome is looked up in the usual places; set CHROME to its path otherwise.
import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { CATALOGUE, findMap, missingPictures, type CatalogueMap } from '../src/catalogue.ts';
import { fail, message } from './cli.ts';
import { LOCALES, isLocale, type Locale } from '../src/i18n/index.ts';

const args = process.argv.slice(2);
const missingAt = args.indexOf('--missing');
const onlyMissing = missingAt >= 0;
if (onlyMissing) args.splice(missingAt, 1);
const jobsAt = args.indexOf('--jobs');
const jobsArg = jobsAt >= 0 ? args.splice(jobsAt, 2)[1] : undefined;
const jobs = jobsAt >= 0 ? Number(jobsArg) : Math.min(4, Math.max(1, Math.floor(availableParallelism() / 2)));
if (!Number.isInteger(jobs) || jobs < 1) fail('--jobs needs a whole number of 1 or more');
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

// Every version asked for, map by map so that one map's locales are taken together.
const missing = onlyMissing ? missingPictures((path) => existsSync(new URL(path, publicDir))) : [];
const versions = maps.flatMap((map) => locales.map((locale) => ({ id: map.id, locale })))
  .filter((v) => !onlyMissing || missing.some((p) => p.id === v.id && p.locale === v.locale));
if (onlyMissing && !versions.length) {
  console.log(`Every ${args.length ? 'selected ' : ''}map has its pictures.`);
  process.exit(0);
}

/** Takes one version's two pictures; returns why it failed, or null. */
async function take(id: string, locale: Locale, profile: string): Promise<string | null> {
  const { paths } = findMap(id, locale)!;
  const url = new URL(`${paths.page}#vignette`, base).href;
  let stdout: string;
  try {
    ({ stdout } = await run(chrome, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
      // Each worker its own profile: Chrome instances sharing one wait on each other.
      `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check',
      '--window-size=1600,1000', '--force-device-scale-factor=2',
      '--virtual-time-budget=30000', '--dump-dom', url,
    ], { maxBuffer: 256 * 1024 * 1024, timeout: 120_000 }));
  } catch (err) {
    return `Chrome failed on ${url}: ${message(err)}`;
  }
  const output = /<output[^>]*id="vignette"[^>]*>/.exec(stdout)?.[0] ?? '';
  const pictures = [['data-src', 'webp', paths.vignette], ['data-share', 'jpeg', paths.share]] as const;
  const found = pictures.map(([attr, type, path]) => ({ attr, path, src: new RegExp(`${attr}="data:image/${type};base64,([^"]+)"`).exec(output)?.[1] }));
  const absent = found.find((p) => !p.src);
  // Both or neither: a version never keeps a new portrait beside an old share picture.
  if (absent) return `no ${absent.attr} picture in ${url}; open it in a browser and read the console`;
  for (const { path, src } of found) {
    const file = new URL(path, publicDir);
    const bytes = Buffer.from(src!, 'base64');
    await mkdir(new URL('.', file), { recursive: true });
    await writeFile(file, bytes);
    console.log(`public/${path}  ${(bytes.length / 1024).toFixed(0)} Ko`);
  }
  return null;
}

const profiles = await mkdtemp(join(tmpdir(), 'vignettes-'));
const failures: string[] = [];
let next = 0;
const started = Date.now();
try {
  await Promise.all(Array.from({ length: Math.min(jobs, versions.length) }, async (_, worker) => {
    const profile = join(profiles, String(worker));
    for (let v = versions[next++]; v; v = versions[next++]) {
      const problem = await take(v.id, v.locale, profile);
      if (problem) failures.push(`${v.id} (${v.locale}): ${problem}`);
    }
  }));
} finally {
  await rm(profiles, { recursive: true, force: true });
}
const seconds = ((Date.now() - started) / 1000).toFixed(0);
if (failures.length) fail(`${failures.length} of ${versions.length} versions failed (${seconds} s):\n${failures.join('\n')}`);
console.log(`${versions.length} version${versions.length > 1 ? 's' : ''} taken in ${seconds} s with ${Math.min(jobs, versions.length)} Chrome at once.`);
