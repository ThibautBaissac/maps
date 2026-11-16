import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { catalogueOf, catalogueProblems, findMap, problemsOf } from '../src/catalogue.ts';
import { PLACES } from '../places/index.ts';
import type { MapEntry } from '../src/registry.ts';

// The repository's own data files, as the build reads them.
function readPublic(path: string): unknown {
  try {
    return JSON.parse(readFileSync(new URL(`../public/${path}`, import.meta.url), 'utf8'));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw err;
  }
}

// A current osm.json, reduced to what the catalogue checks: the square and the download date.
const OSM_FILE = { square: { lat: 52.3712, lon: 4.8936, sizeKm: 2 }, fetchedAt: '2026-11-15T12:59:00.000Z', layers: [] };
const entry = (id: string, extra: Partial<MapEntry> = {}): MapEntry => ({ id, place: 'amsterdam-centre', style: 'riso', topic: 'canal-crossings', ...extra } as MapEntry);

test('a map is titled after its place unless the registry gives a title', () => {
  const [plain, titled] = catalogueOf([entry('plain'), entry('titled', { title: 'Mon quartier' })]);
  assert.equal(plain?.title, 'Amsterdam');
  assert.equal(titled?.title, 'Mon quartier');
});

test('a map knows its page, data and vignette paths', () => {
  const [m] = catalogueOf([entry('amsterdam-test')]);
  assert.deepEqual(m?.paths, {
    page: 'fr/cartes/amsterdam-test/',
    data: 'data/amsterdam-centre/osm.json',
    vignette: 'vignettes/fr/amsterdam-test.webp',
  });
});

test('findMap finds a registered map by id, and nothing for an unknown id', () => {
  assert.equal(findMap('amsterdam-riso')?.placeId, 'amsterdam-centre');
  assert.equal(findMap('nowhere'), undefined);
});

test('a translated map uses the city and district of its language, sharing the same geographic data', () => {
  const en = findMap('lisbonne-cyanotype', 'en');
  const es = findMap('lisbonne-cyanotype', 'es');
  assert.equal(en?.title, 'Lisbon');
  assert.equal(es?.title, 'Lisboa');
  assert.equal(findMap('amsterdam-riso', 'en')?.place.district, 'Historic centre');
  assert.equal(en?.paths.page, 'en/cartes/lisbonne-cyanotype/');
  assert.equal(es?.paths.vignette, 'vignettes/es/lisbonne-cyanotype.webp');
  assert.equal(en?.paths.data, 'data/lisbonne-alfama/osm.json');
  assert.equal(en?.place.lat, findMap('lisbonne-cyanotype')?.place.lat);
  assert.equal(en?.styleDef.label, "Architect’s cyanotype");
  assert.deepEqual(catalogueProblems(readPublic), []);
});

test('the registry and the downloaded data agree', () => {
  assert.deepEqual(catalogueProblems(readPublic), []);
});

test('a map without data is a problem that says how to download it', () => {
  const problems = problemsOf([entry('amsterdam-test')], () => undefined);
  assert.equal(problems.length, 1);
  assert.equal(problems[0]?.id, 'amsterdam-test');
  assert.match(problems[0]?.message ?? '', /npm run fetch-data -- amsterdam-centre/);
});

// Each geographic field of the place recorded in the data's square must still match it.
for (const [field, older] of [['lat', 52.4], ['lon', 4.1], ['sizeKm', 3]] as const) {
  test(`data downloaded with an older ${field} is a problem naming the field and both values`, () => {
    const stale = { ...OSM_FILE, square: { ...OSM_FILE.square, [field]: older } };
    const problems = problemsOf([entry('amsterdam-test')], () => stale);
    assert.equal(problems.length, 1);
    assert.equal(problems[0]?.message, `data for amsterdam-centre is out of date (amsterdam-test): ${field} is ${JSON.stringify(PLACES['amsterdam-centre'][field])} in places/index.ts but ${JSON.stringify(older)} in the data; run npm run fetch-data -- amsterdam-centre`);
  });
}

test('data without fetchedAt is a problem that says how to download it again', () => {
  const { fetchedAt: _, ...undated } = OSM_FILE;
  const problems = problemsOf([entry('amsterdam-test')], () => undated);
  assert.equal(problems[0]?.message, 'data/amsterdam-centre/osm.json has no fetchedAt (amsterdam-test); run npm run fetch-data -- amsterdam-centre');
});

test('unreadable data or data without a square is a problem naming the file', () => {
  for (const data of [null, {}, { square: 'x' }]) {
    const problems = problemsOf([entry('amsterdam-test')], () => data);
    assert.equal(problems.length, 1);
    assert.match(problems[0]?.message ?? '', /^data\/amsterdam-centre\/osm\.json: /);
  }
});

test('invalid and duplicate map ids are problems', () => {
  const current = OSM_FILE;
  const problems = problemsOf([entry('Bad_Id'), entry('twice'), entry('twice')], () => current);
  assert.deepEqual(problems.map((p) => p.id), ['Bad_Id', 'twice']);
  assert.match(problems[0]?.message ?? '', /invalid id "Bad_Id"/);
  assert.match(problems[1]?.message ?? '', /duplicate id "twice"/);
});

// Node and Vite strip types: an entry the type-checker would refuse still reaches the catalogue.
test('an entry naming an unknown place or style is a problem, and is left out of the catalogue', () => {
  const current = OSM_FILE;
  const broken = [entry('no-place', { place: 'kyoto-gion' as never }), entry('no-style', { style: 'neon' as never })];
  const problems = problemsOf([...broken, entry('fine')], () => current);
  assert.deepEqual(problems.map((p) => p.id), ['no-place', 'no-style']);
  assert.match(problems[0]?.message ?? '', /unknown place "kyoto-gion"/);
  assert.match(problems[1]?.message ?? '', /unknown style "neon"/);
  assert.deepEqual(catalogueOf([...broken, entry('fine')]).map((m) => m.id), ['fine']);
});

test('an unknown subject is reported and left out of the catalogue before page generation', () => {
  const broken = entry('bad-topic', { topic: 'unknown' as never });
  assert.match(problemsOf([broken], () => OSM_FILE)[0]?.message ?? '', /unknown topic/);
  assert.deepEqual(catalogueOf([broken, entry('fine')]).map((m) => m.id), ['fine']);
});

test('a map without a subject is refused before page generation', () => {
  const missing = entry('no-topic', { topic: undefined as never });
  assert.match(problemsOf([missing], () => OSM_FILE)[0]?.message ?? '', /missing topic/);
  assert.deepEqual(catalogueOf([missing]), []);
});

// External layers: the registry injected into problemsOf and catalogueOf stands for places/layers.ts.
const SPEC = { title: { fr: 'Ponts', en: 'Bridges', es: 'Puentes' }, file: 'layers/amsterdam-centre/ponts.geojson', kind: 'points', role: 'overlay', attribution: '© Ville d’Amsterdam' } as const;
const LAYER_REGISTRY = { 'amsterdam-centre': { ponts: SPEC } } as const;
const layerFile = (sizeKm = 2): unknown => ({
  square: { lat: 52.3712, lon: 4.8936, sizeKm },
  layers: [{ id: 'ponts', kind: 'points', role: 'overlay', attribution: '© Ville d’Amsterdam', source: 'layers/amsterdam-centre/ponts.geojson', features: [{ g: [0, 0], n: 'Magere Brug' }] }],
});
const withLayer = (file: unknown) => (path: string): unknown => path === 'data/amsterdam-centre/ponts.json' ? file : OSM_FILE;
const layered = (id = 'with-layer'): MapEntry => entry(id, { layers: ['ponts'] });

test('a map naming a layer the place does not declare is a problem listing the known layers', () => {
  const problems = problemsOf([entry('amsterdam-test', { layers: ['tunnels'] })], withLayer(layerFile()), LAYER_REGISTRY);
  assert.equal(problems[0]?.message, 'unknown layer "tunnels" for amsterdam-centre (amsterdam-test); known: ponts');
});

test('layer ids "osm" and not-a-slug are refused', () => {
  const reserved = problemsOf([layered()], withLayer(layerFile()), { 'amsterdam-centre': { osm: SPEC } });
  assert.equal(reserved[0]?.message, 'layer id "osm" is reserved (amsterdam-centre)');
  const invalid = problemsOf([layered()], withLayer(layerFile()), { 'amsterdam-centre': { Ponts: SPEC } });
  assert.equal(invalid[0]?.message, 'invalid layer id "Ponts" for amsterdam-centre (use a-z, 0-9 and -)');
});

test('a layer without its file is a problem that says how to convert it', () => {
  const problems = problemsOf([layered()], withLayer(undefined), LAYER_REGISTRY);
  assert.equal(problems[0]?.message, 'no data for layer "ponts" of amsterdam-centre (with-layer); run npm run layers -- amsterdam-centre');
});

test('a layer file for another square size is out of date', () => {
  const problems = problemsOf([layered()], withLayer(layerFile(3)), LAYER_REGISTRY);
  assert.equal(problems[0]?.message, 'layer "ponts" of amsterdam-centre is out of date (with-layer): sizeKm is 2 in places/index.ts but 3 in the data; run npm run layers -- amsterdam-centre');
});

test('a layer file that differs from its declaration is out of date, field by field', () => {
  const file = (patch: object): unknown => {
    const f = layerFile() as { layers: object[] };
    return { ...f, layers: [{ ...f.layers[0], ...patch }] };
  };
  const relayer = 'run npm run layers -- amsterdam-centre';
  for (const [field, patch] of [['id', { id: 'tunnels' }], ['kind', { kind: 'lines', features: [{ g: [0, 0, 5, 5] }] }], ['attribution', { attribution: '© Autre' }]] as const) {
    const problems = problemsOf([layered()], withLayer(file(patch)), LAYER_REGISTRY);
    assert.equal(problems[0]?.message, `layer "ponts" of amsterdam-centre does not match places/layers.ts (with-layer): ${field} differs; ${relayer}`);
  }
});

test('an invalid layer file is a problem prefixed by its path', () => {
  const problems = problemsOf([layered()], withLayer({ square: 1 }), LAYER_REGISTRY);
  assert.match(problems[0]?.message ?? '', /^data\/amsterdam-centre\/ponts\.json: square must hold/);
});

test('a valid layer file is no problem, and the catalogue lists the layer and its attribution', () => {
  assert.deepEqual(problemsOf([layered()], withLayer(layerFile()), LAYER_REGISTRY), []);
  const [m] = catalogueOf([layered(), ], 'fr', LAYER_REGISTRY);
  assert.deepEqual(m?.layers, [{ id: 'ponts', title: 'Ponts', path: 'data/amsterdam-centre/ponts.json' }]);
  assert.deepEqual(m?.attributions, ['© Ville d’Amsterdam']);
  assert.equal(catalogueOf([layered()], 'en', LAYER_REGISTRY)[0]?.layers[0]?.title, 'Bridges');
});

test('a map without layers has none and no extra attribution', () => {
  const [m] = catalogueOf([entry('plain')]);
  assert.deepEqual(m?.layers, []);
  assert.deepEqual(m?.attributions, []);
});
