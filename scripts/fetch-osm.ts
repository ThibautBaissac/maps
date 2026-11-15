// Downloads OpenStreetMap data for one place of places/ (once), projects it to
// local metres and writes a compact public/data/<place>.json.
// Usage: npm run fetch-data -- <place-id>     (e.g. amsterdam-centre)
import { access, mkdir, writeFile } from 'node:fs/promises';
import { isRoadKind, type BBox, type Line, type MapData, type Ring, type Road, type Water, type Waterway } from '../src/data.ts';
import { parsePlace } from '../src/place.ts';

// Flat coordinate arrays hold [x, y] pairs: an index bounded by the length (stepping by 2)
// is always defined, hence the `!` in the loops below.

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const PLACE = process.argv[2] ?? '';
if (!/^[a-z0-9-]+$/.test(PLACE)) fail('Usage: npm run fetch-data -- <place-id>   (a file name of places/, without .ts)');
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

const isOverpassAnswer = (v: unknown): v is OverpassAnswer =>
  typeof v === 'object' && v !== null && Array.isArray((v as { elements?: unknown }).elements);

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err));

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
const r1 = (v: number): number => Math.round(v * 10) / 10;
const project = (geom: readonly LatLon[]): Line => {
  const out: Line = [];
  for (const p of geom) out.push(r1((p.lon - CITY.lon) * kx), r1((p.lat - CITY.lat) * ky));
  return out;
};

const key = (a: Line, i: number): string => `${a[i]},${a[i + 1]}`;

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

// Sea and estuaries are not water areas in OSM but coastline ways (land on the left,
// water on the right). Turns those crossing the square [-H, H]² into water polygons.
function seaPolygons(lines: readonly Line[], H: number): Water[] {
  // Directed chains: a way's end joins the next way's start.
  const pool = lines.filter((l) => l.length >= 4).map((l) => l.slice());
  const chains: Line[] = [];
  let first: Line | undefined;
  while ((first = pool.shift())) {
    let c = first;
    for (let grown = true; grown;) {
      grown = false;
      const i = pool.findIndex((l) => key(l, 0) === key(c, c.length - 2));
      if (i >= 0) { c = c.concat(pool.splice(i, 1)[0]!.slice(2)); grown = true; continue; }
      const j = pool.findIndex((l) => key(l, l.length - 2) === key(c, 0));
      if (j >= 0) { c = pool.splice(j, 1)[0]!.concat(c.slice(2)); grown = true; }
    }
    chains.push(c);
  }
  const inside = (x: number, y: number): boolean => Math.abs(x) <= H && Math.abs(y) <= H;
  const onEdge = (x: number, y: number): boolean => Math.abs(Math.abs(x) - H) < 0.05 || Math.abs(Math.abs(y) - H) < 0.05;
  // Clockwise position along the square's border, from the north-west corner, in [0, 4).
  const along = (x: number, y: number): number => {
    if (Math.abs(y - H) < 0.05) return (x + H) / (2 * H);
    if (Math.abs(x - H) < 0.05) return 1 + (H - y) / (2 * H);
    if (Math.abs(y + H) < 0.05) return 2 + (H - x) / (2 * H);
    return 3 + (y + H) / (2 * H);
  };
  const corners: [number, number][] = [[-H, H], [H, H], [H, -H], [-H, -H]]; // at positions 0, 1, 2, 3
  // Liang–Barsky: part of segment a→b inside the square, as [t0, t1], or null.
  const clip = (ax: number, ay: number, bx: number, by: number): [number, number] | null => {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    const edges: [number, number][] = [[-dx, ax + H], [dx, H - ax], [-dy, ay + H], [dy, H - ay]];
    for (const [p, q] of edges) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [t0, t1];
  };

  interface Piece { p: Line; tin: number; tout: number }
  const pieces: Line[] = [], islands: Ring[] = [];
  for (const c of chains) {
    const closed = key(c, 0) === key(c, c.length - 2);
    if (closed && c.every((v, i) => i % 2 || inside(v, c[i + 1]!))) { islands.push(c); continue; }
    let cur: Line | null = null;
    for (let i = 2; i < c.length; i += 2) {
      const ax = c[i - 2]!, ay = c[i - 1]!, bx = c[i]!, by = c[i + 1]!;
      const t = clip(ax, ay, bx, by);
      if (!t) continue;
      const p0 = [r1(ax + (bx - ax) * t[0]), r1(ay + (by - ay) * t[0])];
      const p1 = [r1(ax + (bx - ax) * t[1]), r1(ay + (by - ay) * t[1])];
      cur ??= [...p0];
      cur.push(...p1);
      if (t[1] < 1) { pieces.push(cur); cur = null; }
    }
    if (cur) pieces.push(cur); // ends inside: incomplete data, dropped below
  }
  const ok: Piece[] = pieces
    .filter((p) => p.length >= 4 && onEdge(p[0]!, p[1]!) && onEdge(p.at(-2)!, p.at(-1)!))
    .map((p) => ({ p, tin: along(p[0]!, p[1]!), tout: along(p.at(-2)!, p.at(-1)!) }));

  // Follow each piece, then the border clockwise to the next piece's entry, until closed.
  const polys: { r: Ring[] }[] = [];
  const used = new Set<Piece>();
  for (const start of ok) {
    if (used.has(start)) continue;
    used.add(start);
    const ring: Ring = [...start.p];
    let cur = start;
    for (let guard = 0; guard < ok.length + 1; guard++) {
      const t = cur.tout;
      let next: Piece | null = null, best = Infinity;
      for (const pc of ok) {
        if (used.has(pc) && pc !== start) continue;
        const d = (pc.tin - t + 4) % 4;
        if (d < best) { best = d; next = pc; }
      }
      for (let k = 1; k <= 4; k++) {
        const ck = Math.ceil(t + 1e-9) + k - 1; // corners after t, clockwise
        if (ck - t >= best) break;
        ring.push(...corners[ck % 4]!);
      }
      if (next === start || !next) break;
      used.add(next);
      ring.push(...next.p);
      cur = next;
    }
    polys.push({ r: [ring] });
  }
  // Each island becomes a hole of the one sea polygon that contains it.
  const contains = (ring: Ring, x: number, y: number): boolean => {
    let inPoly = false;
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i]!, yi = ring[i + 1]!, xj = ring[j]!, yj = ring[j + 1]!;
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inPoly = !inPoly;
    }
    return inPoly;
  };
  for (const isl of islands) polys.find((p) => contains(p.r[0]!, isl[0]!, isl[1]!))?.r.push(isl);
  return polys;
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
  bâtiments: data.buildings.length,
  routes: data.roads.length,
  'cours d’eau': data.waterways.length,
  'plans d’eau': data.water.length,
  'parcs / espaces verts': data.parks.length,
  'rues nommées': new Set(data.roads.flatMap((r) => (r.n ? [r.n] : []))).size,
});
console.log(`Saved ${out.pathname}`);
