// Downloads OpenStreetMap data for one place of places/index.ts (once), converts it to
// local metres (scripts/osm.ts) and writes a compact public/data/<place>.json (dataPath in
// places/index.ts). The raw answer is kept in .cache/overpass/<place>.json (git-ignored):
// --offline converts that cached answer again, without network, keeping its server and date.
// Usage: npm run fetch-data -- <place-id> [--offline]     (e.g. amsterdam-centre)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dataPath, isPlaceId, PLACES } from '../places/index.ts';
import { featureCounts } from '../src/data.ts';
import { fail, message } from './cli.ts';
import { convertOsm, overpassQuery, parseCachedAnswer, parseOverpassAnswer, QUERY_TIMEOUT_S, type CachedAnswer, type OverpassAnswer } from './osm.ts';

const args = process.argv.slice(2);
const OFFLINE = args.includes('--offline');
const PLACE = args.find((a) => !a.startsWith('--')) ?? '';
const unknown = args.filter((a) => a.startsWith('--') && a !== '--offline');
if (!PLACE || unknown.length) fail('Usage: npm run fetch-data -- <place-id> [--offline]   (a key of places/index.ts)');
if (!isPlaceId(PLACE)) fail(`No such place: ${PLACE}. Known: ${Object.keys(PLACES).join(', ')}`);
const CITY = PLACES[PLACE];

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const ROUNDS = 2;
const PAUSE_S = 30;

async function download(query: string): Promise<{ answer: OverpassAnswer; url: string }> {
  // Public Overpass servers are often overloaded: try each one, then a second round
  // after a pause, rather than waiting minutes on a single server.
  const errors: string[] = [];
  for (let round = 1; round <= ROUNDS; round++) {
    if (round > 1) {
      console.log(`Round ${round}/${ROUNDS} in ${PAUSE_S} s…`);
      await new Promise((r) => setTimeout(r, PAUSE_S * 1000));
    }
    for (const url of SERVERS) {
      try {
        console.log(`→ ${url}`);
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'illustrated-city-maps/0.1 (one-off data download)',
          },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout((QUERY_TIMEOUT_S + 15) * 1000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        return { answer: parseOverpassAnswer(await res.json()), url };
      } catch (err) {
        console.warn(`  failed: ${message(err)}`);
        errors.push(`round ${round}, ${url}: ${message(err)}`);
      }
    }
  }
  throw new Error('All Overpass servers failed:\n  ' + errors.join('\n  '));
}

const cacheFile = new URL(`../.cache/overpass/${PLACE}.json`, import.meta.url);

// The download to convert: the cached one with --offline, otherwise a new one, cached.
async function source(): Promise<CachedAnswer> {
  if (OFFLINE) {
    const text = await readFile(cacheFile, 'utf8').catch(() =>
      fail(`No cached answer for ${PLACE} (.cache/overpass/${PLACE}.json): run npm run fetch-data -- ${PLACE} once without --offline.`));
    try {
      return parseCachedAnswer(JSON.parse(text), CITY);
    } catch (err) {
      return fail(`.cache/overpass/${PLACE}.json: ${message(err)}`);
    }
  }
  const { answer, url } = await download(overpassQuery(CITY));
  const cached: CachedAnswer = { place: CITY, server: url, fetchedAt: new Date().toISOString(), answer };
  await mkdir(new URL('.', cacheFile), { recursive: true });
  await writeFile(cacheFile, JSON.stringify(cached));
  return cached;
}

const { server, fetchedAt, answer } = await source();
if (OFFLINE) console.log(`Converting the answer cached on ${fetchedAt} (${server})`);
const data = convertOsm(answer, PLACE, { server, fetchedAt });

const out = new URL(`../public/${dataPath(PLACE)}`, import.meta.url);
await mkdir(new URL('.', out), { recursive: true });
await writeFile(out, JSON.stringify(data));

console.log(`\n${CITY.name} — ${CITY.district} (${CITY.sizeKm} km × ${CITY.sizeKm} km)`);
console.table({
  ...featureCounts(data),
  'rues nommées': new Set(data.roads.flatMap((r) => (r.n ? [r.n] : []))).size,
});
console.log(`Saved ${out.pathname}`);
