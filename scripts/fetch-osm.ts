// Downloads OpenStreetMap data for one place of places/index.ts (once), converts it to
// local metres (scripts/osm.ts) and writes a compact public/data/<place>.json (dataPath in
// places/index.ts).
// Usage: npm run fetch-data -- <place-id>     (e.g. amsterdam-centre)
import { mkdir, writeFile } from 'node:fs/promises';
import { dataPath, isPlaceId, PLACES } from '../places/index.ts';
import { featureCounts } from '../src/data.ts';
import { fail, message } from './cli.ts';
import { convertOsm, overpassQuery, parseOverpassAnswer, QUERY_TIMEOUT_S, type OverpassAnswer } from './osm.ts';

const PLACE = process.argv[2] ?? '';
if (!PLACE) fail('Usage: npm run fetch-data -- <place-id>   (a key of places/index.ts)');
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

const { answer, url } = await download(overpassQuery(CITY));
const data = convertOsm(answer, PLACE, { server: url, fetchedAt: new Date().toISOString() });

const out = new URL(`../public/${dataPath(PLACE)}`, import.meta.url);
await mkdir(new URL('.', out), { recursive: true });
await writeFile(out, JSON.stringify(data));

console.log(`\n${CITY.name} — ${CITY.district} (${CITY.sizeKm} km × ${CITY.sizeKm} km)`);
console.table({
  ...featureCounts(data),
  'rues nommées': new Set(data.roads.flatMap((r) => (r.n ? [r.n] : []))).size,
});
console.log(`Saved ${out.pathname}`);
