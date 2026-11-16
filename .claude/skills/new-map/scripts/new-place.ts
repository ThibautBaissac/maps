// Adds a new place to places/index.ts.
//
//   node .claude/skills/new-map/scripts/new-place.ts --city "Lisbonne" --district "Alfama"
//   node .claude/skills/new-map/scripts/new-place.ts --city Kyoto --district Gion --lat 35.0037 --lon 135.7788
//
// Options: --city (required), --district, --lat/--lon (skip geocoding), --size (km, default 2),
// --id (default: slug of city-district), --name / --district-label (displayed texts),
// --dry-run (print, write nothing).
// Without --lat/--lon, the place is geocoded once with OpenStreetMap Nominatim.
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fail, message } from '../../../../scripts/cli.ts';
import { PLACES } from '../../../../places/index.ts';
import { isRecord, isSlug, parsePlace, type Place } from '../../../../src/place.ts';

function parseCli() {
  try {
    return parseArgs({
      options: {
        city: { type: 'string' },
        district: { type: 'string' },
        lat: { type: 'string' },
        lon: { type: 'string' },
        size: { type: 'string' },
        id: { type: 'string' },
        name: { type: 'string' },
        'district-label': { type: 'string' },
        'dry-run': { type: 'boolean' },
      },
    }).values;
  } catch (err) {
    return fail(message(err));
  }
}
const args = parseCli();

const city = args.city ?? fail('Missing --city. Example: --city "Lisbonne" --district "Alfama"');

const slug = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const id = args.id ?? slug([city, args.district].filter(Boolean).join(' '));
if (!isSlug(id)) fail(`Invalid id "${id}"`);
if (Object.hasOwn(PLACES, id)) fail(`"${id}" is already in places/index.ts: reuse it or pass another --id.`);
const indexFile = new URL('../../../../places/index.ts', import.meta.url);
/** Last line of the PLACES object: new entries go just before it. */
const CLOSE = '} as const satisfies Record<string, Place>;';

interface NominatimHit { lat: string; lon: string; display_name: string }
const isHits = (v: unknown): v is NominatimHit[] =>
  Array.isArray(v) && v.every((h) => isRecord(h) && 'lat' in h && 'lon' in h && 'display_name' in h);

let lat = args.lat !== undefined ? Number(args.lat) : NaN;
let lon = args.lon !== undefined ? Number(args.lon) : NaN;
let found = 'coordinates given';
if (Number.isNaN(lat) || Number.isNaN(lon)) {
  const q = [args.district, city].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'illustrated-city-maps/0.1 (one-off geocoding)', 'Accept-Language': 'fr' },
    signal: AbortSignal.timeout(20000),
  }).catch((e: unknown) => fail(`Nominatim unreachable: ${message(e)}. Pass --lat and --lon instead.`));
  if (!res.ok) fail(`Nominatim HTTP ${res.status}. Pass --lat and --lon instead.`);
  const hits: unknown = await res.json();
  if (!isHits(hits)) fail('Unexpected Nominatim answer. Pass --lat and --lon instead.');
  const [best, ...others] = hits;
  if (!best) fail(`No result for "${q}". Check the spelling or pass --lat and --lon.`);
  lat = Number(best.lat);
  lon = Number(best.lon);
  found = best.display_name;
  if (others.length) console.log('Other candidates:\n' + others.map((h) => `  ${h.lat}, ${h.lon}  ${h.display_name}`).join('\n'));
}

const place: Place = parsePlace({
  name: args.name ?? city,
  district: args['district-label'] ?? args.district ?? 'Centre',
  lat: Number(lat.toFixed(4)),
  lon: Number(lon.toFixed(4)),
  sizeKm: Number(args.size ?? 2),
}, 'arguments');

// A string literal for any input (quotes, backslashes, line breaks).
const str = (s: string): string => JSON.stringify(s);
const entry = `  // npm run fetch-data -- ${id}
  // Located from: ${found.replace(/\n/g, ' ')}
  ${str(id)}: {
    name: ${str(place.name)},
    district: ${str(place.district)},
    lat: ${place.lat},
    lon: ${place.lon},
    sizeKm: ${place.sizeKm},
  },
`;
console.log(`id: ${id}\nfound: ${found}\n\n${entry}`);
console.log(`Check on a map: https://www.openstreetmap.org/#map=16/${place.lat}/${place.lon}`);
if (!args['dry-run']) {
  const source = await readFile(indexFile, 'utf8');
  const at = source.indexOf(`\n${CLOSE}`);
  if (at < 0) fail(`places/index.ts: no line "${CLOSE}" to insert before; add the entry by hand.`);
  await writeFile(indexFile, source.slice(0, at + 1) + entry + source.slice(at + 1));
  // Read the file back as the site will; put it back as it was if that fails.
  try {
    const fresh = (await import(`${indexFile.href}?t=${Date.now()}`)) as { PLACES: Record<string, unknown> };
    parsePlace(fresh.PLACES[id], `places/index.ts (${id})`);
  } catch (err) {
    await writeFile(indexFile, source);
    fail(`places/index.ts left unchanged: the new entry does not read back (${message(err)}).`);
  }
  console.log(`Added ${id} to places/index.ts`);
}
