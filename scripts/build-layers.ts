// Converts the GeoJSON sources of one place (declared in places/layers.ts) to local metres
// (scripts/geojson.ts) and writes one layer file per layer, public/data/<place>/<id>.json
// (layerPath in places/layers.ts). The source files live in layers/<place>/<id>.geojson.
// Usage: npm run layers -- <place-id>     (e.g. lisbonne-alfama)
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isPlaceId, PLACES } from '../places/index.ts';
import { LAYERS, layerPath } from '../places/layers.ts';
import type { LayerFile } from '../src/layers.ts';
import { fail, message } from './cli.ts';
import { geojsonLayer } from './geojson.ts';

const args = process.argv.slice(2);
const PLACE = args.find((a) => !a.startsWith('--')) ?? '';
if (!PLACE || args.some((a) => a.startsWith('--'))) fail('Usage: npm run layers -- <place-id>   (a key of places/index.ts)');
if (!isPlaceId(PLACE)) fail(`No such place: ${PLACE}. Known: ${Object.keys(PLACES).join(', ')}`);
const CITY = PLACES[PLACE];
const SPECS = Object.entries(LAYERS[PLACE] ?? {});
if (!SPECS.length) fail(`No layers for ${PLACE} (places/layers.ts)`);

const counts: Record<string, number> = {};
for (const [id, spec] of SPECS) {
  const source = new URL(`../${spec.file}`, import.meta.url);
  const text = await readFile(source, 'utf8').catch(() => fail(`${id}: cannot read ${spec.file}`));
  let layer;
  try {
    layer = geojsonLayer(JSON.parse(text), CITY, id, spec);
  } catch (err) {
    fail(`${id}: ${spec.file}: ${message(err)}`);
  }
  const file: LayerFile = { square: { lat: CITY.lat, lon: CITY.lon, sizeKm: CITY.sizeKm }, layers: [layer] };
  const out = new URL(`../public/${layerPath(PLACE, id)}`, import.meta.url);
  await mkdir(new URL('.', out), { recursive: true });
  await writeFile(out, JSON.stringify(file));
  counts[id] = layer.features.length;
  console.log(`Saved ${out.pathname}`);
}

console.log(`\n${CITY.name} — ${CITY.district}`);
console.table(counts);
