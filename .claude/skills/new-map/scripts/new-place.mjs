// Creates places/<id>.js for a new place.
//
//   node .claude/skills/new-map/scripts/new-place.mjs --city "Lisbonne" --district "Alfama"
//   node .claude/skills/new-map/scripts/new-place.mjs --city Kyoto --district Gion --lat 35.0037 --lon 135.7788
//
// Options: --city (required), --district, --lat/--lon (skip geocoding), --size (km, default 2),
// --id (default: slug of city-district), --name / --district-label (displayed texts),
// --dry-run (print, write nothing).
// Without --lat/--lon, the place is geocoded once with OpenStreetMap Nominatim.
import { access, writeFile } from 'node:fs/promises';

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (!a.startsWith('--')) continue;
  const next = process.argv[i + 1];
  if (next === undefined || next.startsWith('--')) args[a.slice(2)] = true;
  else { args[a.slice(2)] = next; i++; }
}

const fail = (msg) => { console.error(msg); process.exit(1); };
if (!args.city) fail('Missing --city. Example: --city "Lisbonne" --district "Alfama"');

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const id = args.id ?? slug([args.city, args.district].filter(Boolean).join(' '));
if (!/^[a-z0-9-]+$/.test(id)) fail(`Invalid id "${id}"`);
const file = new URL(`../../../../places/${id}.js`, import.meta.url);
if (!args['dry-run']) {
  try { await access(file); fail(`places/${id}.js already exists: reuse it or pass another --id.`); } catch {}
}

let lat = args.lat !== undefined ? Number(args.lat) : NaN;
let lon = args.lon !== undefined ? Number(args.lon) : NaN;
let found = 'coordinates given';
if (Number.isNaN(lat) || Number.isNaN(lon)) {
  const q = [args.district, args.city].filter(Boolean).join(', ');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'illustrated-city-maps/0.1 (one-off geocoding)', 'Accept-Language': 'fr' },
    signal: AbortSignal.timeout(20000),
  }).catch((e) => fail(`Nominatim unreachable: ${e.message}. Pass --lat and --lon instead.`));
  if (!res.ok) fail(`Nominatim HTTP ${res.status}. Pass --lat and --lon instead.`);
  const hits = await res.json();
  if (!hits.length) fail(`No result for "${q}". Check the spelling or pass --lat and --lon.`);
  ({ lat, lon } = { lat: Number(hits[0].lat), lon: Number(hits[0].lon) });
  found = hits[0].display_name;
  if (hits.length > 1) console.log('Other candidates:\n' + hits.slice(1).map((h) => `  ${h.lat}, ${h.lon}  ${h.display_name}`).join('\n'));
}

const place = {
  name: args.name ?? args.city,
  district: args['district-label'] ?? args.district ?? 'Centre',
  lat: Number(lat.toFixed(4)),
  lon: Number(lon.toFixed(4)),
  sizeKm: Number(args.size ?? 2),
};
const src = `// A place to map. Download its data with: npm run fetch-data -- ${id}
// Located from: ${found.replace(/\n/g, ' ')}
export default ${JSON.stringify(place, null, 2).replace(/"([a-zA-Z]+)":/g, '$1:').replace(/"/g, "'")};
`;
console.log(`id: ${id}\nfound: ${found}\n\n${src}`);
console.log(`Check on a map: https://www.openstreetmap.org/#map=16/${place.lat}/${place.lon}`);
if (!args['dry-run']) {
  await writeFile(file, src);
  console.log(`Written places/${id}.js`);
}
