// Downloads OpenStreetMap data for one place of places/ (once), projects it to
// local metres and writes a compact public/data/<place>.json.
// Usage: npm run fetch-data -- <place-id>     (e.g. amsterdam-centre)
import { writeFile, mkdir, access } from 'node:fs/promises';

const PLACE = process.argv[2];
if (!PLACE || !/^[a-z0-9-]+$/.test(PLACE)) {
  console.error('Usage: npm run fetch-data -- <place-id>   (a file name of places/, without .js)');
  process.exit(1);
}
const placeUrl = new URL(`../places/${PLACE}.js`, import.meta.url);
try { await access(placeUrl); } catch {
  console.error(`No such place: places/${PLACE}.js`);
  process.exit(1);
}
const CITY = (await import(placeUrl)).default;

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
const toRad = (d) => (d * Math.PI) / 180;
const half = (CITY.sizeKm * 1000) / 2;
const dLat = (half / R) * (180 / Math.PI);
const dLon = dLat / Math.cos(toRad(CITY.lat));
const bbox = [CITY.lat - dLat, CITY.lon - dLon, CITY.lat + dLat, CITY.lon + dLon];
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

async function download() {
  // Public Overpass servers are often overloaded: try each one, then a second round
  // after a pause, rather than waiting minutes on a single server.
  const errors = [];
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
        const json = await res.json();
        if (!json.elements?.length) throw new Error(`no elements (${json.remark ?? 'empty answer'})`);
        return { json, url };
      } catch (err) {
        console.warn(`  failed: ${err.message}`);
        errors.push(`round ${round}, ${url}: ${err.message}`);
      }
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

// Sea and estuaries are not water areas in OSM but coastline ways (land on the left,
// water on the right). Turns those crossing the square [-H, H]² into water polygons.
function seaPolygons(lines, H) {
  // Directed chains: a way's end joins the next way's start.
  const key = (a, i) => `${a[i]},${a[i + 1]}`;
  const pool = lines.filter((l) => l.length >= 4).map((l) => l.slice());
  const chains = [];
  while (pool.length) {
    let c = pool.shift();
    for (let grown = true; grown;) {
      grown = false;
      const i = pool.findIndex((l) => key(l, 0) === key(c, c.length - 2));
      if (i >= 0) { c = c.concat(pool.splice(i, 1)[0].slice(2)); grown = true; continue; }
      const j = pool.findIndex((l) => key(l, l.length - 2) === key(c, 0));
      if (j >= 0) { c = pool.splice(j, 1)[0].concat(c.slice(2)); grown = true; }
    }
    chains.push(c);
  }
  const inside = (x, y) => Math.abs(x) <= H && Math.abs(y) <= H;
  const onEdge = (x, y) => Math.abs(Math.abs(x) - H) < 0.05 || Math.abs(Math.abs(y) - H) < 0.05;
  // Clockwise position along the square's border, from the north-west corner, in [0, 4).
  const along = (x, y) => {
    if (Math.abs(y - H) < 0.05) return (x + H) / (2 * H);
    if (Math.abs(x - H) < 0.05) return 1 + (H - y) / (2 * H);
    if (Math.abs(y + H) < 0.05) return 2 + (H - x) / (2 * H);
    return 3 + (y + H) / (2 * H);
  };
  const corners = [[-H, H], [H, H], [H, -H], [-H, -H]]; // at positions 0, 1, 2, 3
  // Liang–Barsky: part of segment a→b inside the square, as [t0, t1], or null.
  const clip = (ax, ay, bx, by) => {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    for (const [p, q] of [[-dx, ax + H], [dx, H - ax], [-dy, ay + H], [dy, H - ay]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [t0, t1];
  };

  const pieces = [], islands = [];
  for (const c of chains) {
    const closed = key(c, 0) === key(c, c.length - 2);
    if (closed && c.every((v, i) => i % 2 || inside(v, c[i + 1]))) { islands.push(c); continue; }
    let cur = null;
    for (let i = 2; i < c.length; i += 2) {
      const ax = c[i - 2], ay = c[i - 1], bx = c[i], by = c[i + 1];
      const t = clip(ax, ay, bx, by);
      if (!t) continue;
      const p0 = [r1(ax + (bx - ax) * t[0]), r1(ay + (by - ay) * t[0])];
      const p1 = [r1(ax + (bx - ax) * t[1]), r1(ay + (by - ay) * t[1])];
      if (!cur) cur = { p: [...p0] };
      cur.p.push(...p1);
      if (t[1] < 1) { pieces.push(cur); cur = null; }
    }
    if (cur) pieces.push(cur); // ends inside: incomplete data, dropped below
  }
  const ok = pieces.filter((pc) => onEdge(pc.p[0], pc.p[1]) && onEdge(pc.p.at(-2), pc.p.at(-1)) && pc.p.length >= 4);
  for (const pc of ok) { pc.tin = along(pc.p[0], pc.p[1]); pc.tout = along(pc.p.at(-2), pc.p.at(-1)); }

  // Follow each piece, then the border clockwise to the next piece's entry, until closed.
  const polys = [];
  const used = new Set();
  for (const start of ok) {
    if (used.has(start)) continue;
    used.add(start);
    const ring = [...start.p];
    let cur = start;
    for (let guard = 0; guard < ok.length + 1; guard++) {
      const t = cur.tout;
      let next = null, best = Infinity;
      for (const pc of ok) {
        if (used.has(pc) && pc !== start) continue;
        const d = (pc.tin - t + 4) % 4;
        if (d < best) { best = d; next = pc; }
      }
      for (let k = 1; k <= 4; k++) {
        const ck = Math.ceil(t + 1e-9) + k - 1; // corners after t, clockwise
        if (ck - t >= best) break;
        ring.push(...corners[ck % 4]);
      }
      if (next === start || !next) break;
      used.add(next);
      ring.push(...next.p);
      cur = next;
    }
    polys.push({ r: [ring] });
  }
  // Each island becomes a hole of the one sea polygon that contains it.
  const contains = (ring, x, y) => {
    let inPoly = false;
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inPoly = !inPoly;
    }
    return inPoly;
  };
  for (const isl of islands) polys.find((p) => contains(p.r[0], isl[0], isl[1]))?.r.push(isl);
  return polys;
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
    place: PLACE,
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

const coast = [];
for (const el of json.elements) {
  const t = el.tags ?? {};
  if (el.type === 'way' && t.natural === 'coastline') {
    if (el.geometry) coast.push(project(el.geometry));
  } else if (t.building && t.building !== 'no' && !t['building:part']) {
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

data.water.push(...seaPolygons(coast, half));

await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
const out = new URL(`../public/data/${PLACE}.json`, import.meta.url);
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
