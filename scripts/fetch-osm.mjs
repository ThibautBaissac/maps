// Downloads OpenStreetMap data for the area set in city.config.js (once),
// projects it to local metres and writes a compact data/quartier.json.
// Usage: npm run fetch-data
import { writeFile, mkdir } from 'node:fs/promises';
import { CITY } from '../city.config.js';

const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const R = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;
const half = (CITY.sizeKm * 1000) / 2;
const dLat = (half / R) * (180 / Math.PI);
const dLon = dLat / Math.cos(toRad(CITY.lat));
const bbox = [CITY.lat - dLat, CITY.lon - dLon, CITY.lat + dLat, CITY.lon + dLon];
const bb = bbox.map((v) => v.toFixed(6)).join(',');

const query = `
[out:json][timeout:180];
(
  way["building"](${bb});
  relation["building"]["type"="multipolygon"](${bb});
  way["highway"](${bb});
  way["waterway"](${bb});
  way["natural"="water"](${bb});
  relation["natural"="water"](${bb});
  way["landuse"~"^(basin|reservoir)$"](${bb});
  way["leisure"~"^(park|garden|playground|pitch|nature_reserve)$"](${bb});
  relation["leisure"~"^(park|garden)$"](${bb});
  way["landuse"~"^(grass|recreation_ground|village_green|forest|meadow|cemetery|allotments)$"](${bb});
  relation["landuse"~"^(grass|recreation_ground|forest|cemetery)$"](${bb});
  way["natural"~"^(wood|scrub|grassland)$"](${bb});
);
out geom;`;

async function download() {
  const errors = [];
  for (const url of SERVERS) {
    try {
      console.log(`→ ${url}`);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'riso-city-map/0.1 (one-off data download)',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(240_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const json = await res.json();
      if (!json.elements?.length) throw new Error(`no elements (${json.remark ?? 'empty answer'})`);
      return { json, url };
    } catch (err) {
      console.warn(`  failed: ${err.message}`);
      errors.push(`${url}: ${err.message}`);
    }
  }
  throw new Error('All Overpass servers failed:\n  ' + errors.join('\n  '));
}

// Local equirectangular projection, metres, x east / y north, 0.1 m precision.
const kx = R * toRad(1) * Math.cos(toRad(CITY.lat));
const ky = R * toRad(1);
const r1 = (v) => Math.round(v * 10) / 10;
const project = (geom) => {
  const out = [];
  for (const p of geom) out.push(r1((p.lon - CITY.lon) * kx), r1((p.lat - CITY.lat) * ky));
  return out;
};

// Joins relation member ways into closed rings by matching endpoints.
function assembleRings(lines) {
  const key = (a, i) => `${a[i]},${a[i + 1]}`;
  const pool = lines.filter((l) => l.length >= 4).map((l) => l.slice());
  const rings = [];
  while (pool.length) {
    let ring = pool.shift();
    let guard = 0;
    while (key(ring, 0) !== key(ring, ring.length - 2) && guard++ < 10000) {
      const end = key(ring, ring.length - 2);
      let idx = -1, reverse = false;
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i];
        if (key(l, 0) === end) { idx = i; break; }
        if (key(l, l.length - 2) === end) { idx = i; reverse = true; break; }
      }
      if (idx < 0) break; // open ring: keep what we have
      let next = pool.splice(idx, 1)[0];
      if (reverse) {
        const rev = [];
        for (let i = next.length - 2; i >= 0; i -= 2) rev.push(next[i], next[i + 1]);
        next = rev;
      }
      ring = ring.concat(next.slice(2));
    }
    if (ring.length >= 6) rings.push(ring);
  }
  return rings;
}

function polygonRings(el) {
  if (el.type === 'way') return el.geometry ? [project(el.geometry)] : [];
  const members = (el.members ?? []).filter((m) => m.type === 'way' && m.geometry);
  const outer = assembleRings(members.filter((m) => m.role !== 'inner').map((m) => project(m.geometry)));
  const inner = assembleRings(members.filter((m) => m.role === 'inner').map((m) => project(m.geometry)));
  return [...outer, ...inner];
}

const ROAD_TYPES = new Set([
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link',
  'living_street', 'service', 'pedestrian', 'footway', 'cycleway', 'path', 'steps', 'track',
]);
const isWater = (t) => t.natural === 'water' || t.landuse === 'basin' || t.landuse === 'reservoir' || t.waterway === 'riverbank';
const isPark = (t) =>
  /^(park|garden|playground|pitch|nature_reserve)$/.test(t.leisure ?? '') ||
  /^(grass|recreation_ground|village_green|forest|meadow|cemetery|allotments)$/.test(t.landuse ?? '') ||
  /^(wood|scrub|grassland)$/.test(t.natural ?? '');

const { json, url } = await download();
const data = {
  meta: {
    ...CITY,
    bbox,
    half,
    server: url,
    fetchedAt: new Date().toISOString(),
    osmTimestamp: json.osm3s?.timestamp_osm_base,
    attribution: '© contributeurs OpenStreetMap (ODbL)',
  },
  buildings: [],
  roads: [],
  waterways: [],
  water: [],
  parks: [],
};

for (const el of json.elements) {
  const t = el.tags ?? {};
  if (t.building && t.building !== 'no' && !t['building:part']) {
    const r = polygonRings(el);
    if (r.length) data.buildings.push(r);
  } else if (el.type === 'way' && t.highway && ROAD_TYPES.has(t.highway) && t.area !== 'yes') {
    const road = { k: t.highway, p: project(el.geometry) };
    if (t.name) road.n = t.name;
    if (t.bridge && t.bridge !== 'no') road.b = 1;
    if (t.tunnel && t.tunnel !== 'no') road.u = 1;
    data.roads.push(road);
  } else if (el.type === 'way' && t.waterway && t.waterway !== 'riverbank' && t.waterway !== 'dam') {
    const w = { k: t.waterway, p: project(el.geometry) };
    if (t.name) w.n = t.name;
    if (t.tunnel && t.tunnel !== 'no') w.u = 1;
    data.waterways.push(w);
  } else if (isWater(t)) {
    const r = polygonRings(el);
    if (r.length) data.water.push(t.name ? { n: t.name, r } : { r });
  } else if (isPark(t)) {
    const r = polygonRings(el);
    if (r.length) data.parks.push({ k: t.leisure ?? t.landuse ?? t.natural, r });
  }
}

await mkdir(new URL('../data/', import.meta.url), { recursive: true });
const out = new URL('../data/quartier.json', import.meta.url);
await writeFile(out, JSON.stringify(data));

console.log(`\n${CITY.name} — ${CITY.district} (${CITY.sizeKm} km × ${CITY.sizeKm} km)`);
console.table({
  bâtiments: data.buildings.length,
  routes: data.roads.length,
  'cours d’eau': data.waterways.length,
  'plans d’eau': data.water.length,
  'parcs / espaces verts': data.parks.length,
  'rues nommées': new Set(data.roads.filter((r) => r.n).map((r) => r.n)).size,
});
console.log(`Saved ${out.pathname}`);
