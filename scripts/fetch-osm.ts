// Downloads OpenStreetMap data for one place of places/ (once), projects it to
// local metres and writes a compact public/data/<place>.json.
// Usage: npm run fetch-data -- <place-id>     (e.g. amsterdam-centre)
import { access, mkdir, writeFile } from 'node:fs/promises';
import { endpointKey as key, r1, seaPolygons } from './coastline.ts';
import { featureCounts, isRoadKind, type BBox, type Line, type MapData, type Ring, type Road, type Waterway } from '../src/data.ts';
import { isRecord, isSlug, parsePlace } from '../src/place.ts';
import { fail, message } from './cli.ts';

// Flat coordinate arrays hold [x, y] pairs: an index bounded by the length (stepping by 2)
// is always defined, hence the `!` in the loops below.

const PLACE = process.argv[2] ?? '';
if (!isSlug(PLACE)) fail('Usage: npm run fetch-data -- <place-id>   (a file name of places/, without .ts)');
const placeUrl = new URL(`../places/${PLACE}.ts`, import.meta.url);
try { await access(placeUrl); } catch { fail(`No such place: places/${PLACE}.ts`); }
const CITY = parsePlace((await import(placeUrl.href) as { default?: unknown }).default, `places/${PLACE}.ts`);

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const QUERY_TIMEOUT_S = 120; // per server
const ROUNDS = 2;
const PAUSE_S = 30;

const R = 6371008.8;
const toRad = (d: number): number => (d * Math.PI) / 180;
const half = (CITY.sizeKm * 1000) / 2;
const dLat = (half / R) * (180 / Math.PI);
const dLon = dLat / Math.cos(toRad(CITY.lat));
const bbox: BBox = [CITY.lat - dLat, CITY.lon - dLon, CITY.lat + dLat, CITY.lon + dLon];
const bb = bbox.map((v) => v.toFixed(6)).join(',');

const query = `
[out:json][timeout:${QUERY_TIMEOUT_S}];
(
  way["building"](${bb});
  relation["building"]["type"="multipolygon"](${bb});
  way["highway"](${bb});
  way["waterway"](${bb});
  way["natural"="water"](${bb});
  way["natural"="coastline"](${bb});
  relation["natural"="water"](${bb});
  way["landuse"~"^(basin|reservoir)$"](${bb});
  way["leisure"~"^(park|garden|playground|pitch|nature_reserve)$"](${bb});
  relation["leisure"~"^(park|garden)$"](${bb});
  way["landuse"~"^(grass|recreation_ground|village_green|forest|meadow|cemetery|allotments)$"](${bb});
  relation["landuse"~"^(grass|recreation_ground|forest|cemetery)$"](${bb});
  way["natural"~"^(wood|scrub|grassland)$"](${bb});
);
out geom;`;

// The part of the Overpass answer (out geom) this script reads.
interface LatLon { lat: number; lon: number }
interface OsmTags {
  [key: string]: string | undefined;
  area?: string;
  bridge?: string;
  building?: string;
  highway?: string;
  landuse?: string;
  leisure?: string;
  name?: string;
  natural?: string;
  tunnel?: string;
  waterway?: string;
}
interface OsmMember { type: string; role: string; geometry?: LatLon[] }
interface OsmElement { type: 'node' | 'way' | 'relation'; tags?: OsmTags; geometry?: LatLon[]; members?: OsmMember[] }
interface OverpassAnswer { elements: OsmElement[]; remark?: string; osm3s?: { timestamp_osm_base?: string } }

const isOverpassAnswer = (v: unknown): v is OverpassAnswer => isRecord(v) && Array.isArray(v['elements']);

async function download(): Promise<{ json: OverpassAnswer; url: string }> {
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
        const json: unknown = await res.json();
        if (!isOverpassAnswer(json)) throw new Error('unexpected answer');
        if (!json.elements.length) throw new Error(`no elements (${json.remark ?? 'empty answer'})`);
        return { json, url };
      } catch (err) {
        console.warn(`  failed: ${message(err)}`);
        errors.push(`round ${round}, ${url}: ${message(err)}`);
      }
    }
  }
  throw new Error('All Overpass servers failed:\n  ' + errors.join('\n  '));
}

// Local equirectangular projection, metres, x east / y north, 0.1 m precision.
const kx = R * toRad(1) * Math.cos(toRad(CITY.lat));
const ky = R * toRad(1);
const project = (geom: readonly LatLon[]): Line => {
  const out: Line = [];
  for (const p of geom) out.push(r1((p.lon - CITY.lon) * kx), r1((p.lat - CITY.lat) * ky));
  return out;
};

// Joins relation member ways into closed rings by matching endpoints.
function assembleRings(lines: readonly Line[]): Ring[] {
  const pool = lines.filter((l) => l.length >= 4).map((l) => l.slice());
  const rings: Ring[] = [];
  let first: Line | undefined;
  while ((first = pool.shift())) {
    let ring = first;
    let guard = 0;
    while (key(ring, 0) !== key(ring, ring.length - 2) && guard++ < 10000) {
      const end = key(ring, ring.length - 2);
      let idx = -1, reverse = false;
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i]!;
        if (key(l, 0) === end) { idx = i; break; }
        if (key(l, l.length - 2) === end) { idx = i; reverse = true; break; }
      }
      if (idx < 0) break; // open ring: keep what we have
      let next = pool.splice(idx, 1)[0]!;
      if (reverse) {
        const rev: Line = [];
        for (let i = next.length - 2; i >= 0; i -= 2) rev.push(next[i]!, next[i + 1]!);
        next = rev;
      }
      ring = ring.concat(next.slice(2));
    }
    if (ring.length >= 6) rings.push(ring);
  }
  return rings;
}

function polygonRings(el: OsmElement): Ring[] {
  if (el.type === 'way') return el.geometry ? [project(el.geometry)] : [];
  const members = (el.members ?? []).flatMap((m) => (m.type === 'way' && m.geometry ? [{ role: m.role, geometry: m.geometry }] : []));
  const outer = assembleRings(members.filter((m) => m.role !== 'inner').map((m) => project(m.geometry)));
  const inner = assembleRings(members.filter((m) => m.role === 'inner').map((m) => project(m.geometry)));
  return [...outer, ...inner];
}


const isWater = (t: OsmTags): boolean => t.natural === 'water' || t.landuse === 'basin' || t.landuse === 'reservoir' || t.waterway === 'riverbank';
const isPark = (t: OsmTags): boolean =>
  /^(park|garden|playground|pitch|nature_reserve)$/.test(t.leisure ?? '') ||
  /^(grass|recreation_ground|village_green|forest|meadow|cemetery|allotments)$/.test(t.landuse ?? '') ||
  /^(wood|scrub|grassland)$/.test(t.natural ?? '');

const { json, url } = await download();
const osmTimestamp = json.osm3s?.timestamp_osm_base;
const data: MapData = {
  meta: {
    place: PLACE,
    ...CITY,
    bbox,
    half,
    server: url,
    fetchedAt: new Date().toISOString(),
    ...(osmTimestamp ? { osmTimestamp } : {}),
    attribution: '© contributeurs OpenStreetMap (ODbL)',
  },
  buildings: [],
  roads: [],
  waterways: [],
  water: [],
  parks: [],
};

const coast: Line[] = [];
for (const el of json.elements) {
  const t = el.tags ?? {};
  if (el.type === 'way' && t.natural === 'coastline') {
    if (el.geometry) coast.push(project(el.geometry));
  } else if (t.building && t.building !== 'no' && !t['building:part']) {
    const r = polygonRings(el);
    if (r.length) data.buildings.push(r);
  } else if (el.type === 'way' && t.highway && isRoadKind(t.highway) && t.area !== 'yes') {
    if (!el.geometry) continue;
    const road: Road = { k: t.highway, p: project(el.geometry) };
    if (t.name) road.n = t.name;
    if (t.bridge && t.bridge !== 'no') road.b = 1;
    if (t.tunnel && t.tunnel !== 'no') road.u = 1;
    data.roads.push(road);
  } else if (el.type === 'way' && t.waterway && t.waterway !== 'riverbank' && t.waterway !== 'dam') {
    if (!el.geometry) continue;
    const w: Waterway = { k: t.waterway, p: project(el.geometry) };
    if (t.name) w.n = t.name;
    if (t.tunnel && t.tunnel !== 'no') w.u = 1;
    data.waterways.push(w);
  } else if (isWater(t)) {
    const r = polygonRings(el);
    if (r.length) data.water.push(t.name ? { n: t.name, r } : { r });
  } else if (isPark(t)) {
    const r = polygonRings(el);
    const k = t.leisure ?? t.landuse ?? t.natural;
    if (r.length && k) data.parks.push({ k, r });
  }
}

data.water.push(...seaPolygons(coast, half));

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
const out = new URL(`../public/data/${PLACE}.json`, import.meta.url);
await writeFile(out, JSON.stringify(data));

console.log(`\n${CITY.name} — ${CITY.district} (${CITY.sizeKm} km × ${CITY.sizeKm} km)`);
console.table({
  ...featureCounts(data),
  'rues nommées': new Set(data.roads.flatMap((r) => (r.n ? [r.n] : []))).size,
});
console.log(`Saved ${out.pathname}`);
