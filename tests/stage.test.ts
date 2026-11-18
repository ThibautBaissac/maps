// Every style driven through its real mount(), on a fake page (tests/dom.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MapHandle, MountArgs } from '../src/styles/contract.ts';
import { sheetLayout } from '../src/styles/cyanotype/sheet.ts';
import { decoLayout } from '../src/styles/art-deco/sheet.ts';
import type { Rect } from '../src/toolkit/geometry.ts';
import { computeLayout } from '../src/toolkit/layout.ts';
import { installPage, nameGlyphs, type FakeCanvas } from './dom.ts';
import type { Locale } from '../src/i18n/index.ts';
import { osmLayersOf, readOsm } from './osm-file.ts';
import { prepareLabels } from '../src/toolkit/labels.ts';
import { analyseTopic } from '../src/topics.ts';

const osm = readOsm('amsterdam-centre');
const SIZE = { width: 800, height: 600 };
/** Pixel density of the overlay tests: device px differ from CSS px, as on most screens. */
const DPR = 2;

const STYLES = {
  riso: () => import('../src/styles/riso/index.ts'),
  cyanotype: () => import('../src/styles/cyanotype/index.ts'),
  'gravure-sepia': () => import('../src/styles/gravure-sepia/index.ts'),
  'art-deco': () => import('../src/styles/art-deco/index.ts'),
} as const;
const ALL = ['riso', 'cyanotype', 'gravure-sepia', 'art-deco'] as const;

async function mountStyle(t: Parameters<typeof installPage>[0], style: keyof typeof STYLES, { title = 'Mon quartier', dpr = 1, locale = 'fr' as Locale, width = SIZE.width, height = SIZE.height } = {}) {
  const page = installPage(t, { width, height, dpr });
  const { mount } = await STYLES[style]();
  const args: MountArgs<object> = { container: page.container, meta: osm.mountMeta(title), locale, options: {}, shell: page.shell, layers: osm.layers };
  const handle: MapHandle = await (mount as (a: MountArgs<object>) => Promise<MapHandle>)(args);
  page.cleanup(() => handle.destroy());
  return { ...page, handle };
}

// The stage's own sequence: clear, paper, then the map buffer clipped to the map window
// and re-projected (clip, setTransform, drawImage).
for (const style of ALL) {
  test(`${style}: mount resolves with a crisp render already on the stage canvas`, async (t) => {
    const calls = (await mountStyle(t, style)).stage().calls;
    const paper = calls.findIndex((k, i) => k.method === 'drawImage' && calls[i - 1]?.method === 'clearRect');
    assert.ok(paper >= 0, 'The stage must show the paper once mount resolves');
    const paperImage = calls[paper]!.args[0];
    const map = calls.findIndex((k, i) => k.method === 'drawImage' && k.args[0] !== paperImage
      && calls[i - 1]?.method === 'setTransform' && calls[i - 2]?.method === 'clip');
    assert.ok(map > paper, 'The stage must show the map buffer over the paper once mount resolves');
  });
}

test('a reference can centre the real viewport, render immediately and return to the overview', async (t) => {
  const page = await mountStyle(t, 'riso');
  const viewport = page.handle.viewport!;
  assert.equal(typeof viewport.goTo, 'function');
  const overview = { ...viewport.view };
  viewport.goTo({ x: 200, y: -100, s: 2 });
  assert.deepEqual(viewport.view, { x: 200, y: -100, s: 2 });
  viewport.goTo({ x: 0, y: 0, s: 0 });
  assert.deepEqual(viewport.view, overview);
});

for (const style of ALL) {
  test(`${style} shows the subject's stairs even at the overview zoom`, async (t) => {
    const page = installPage(t, SIZE);
    const layers = osmLayersOf({ roads: [{ g: [-20, 0, 20, 0], k: 'steps', n: 'Escadinhas' }] });
    const { mount } = await STYLES[style]();
    const handle = await mount({ container: page.container, shell: page.shell, meta: osm.mountMeta('Test'), options: {}, locale: 'fr', layers, topic: analyseTopic(osm.survey, layers, 'steps') });
    page.cleanup(() => handle.destroy());
    for (const c of page.canvases) c.calls.length = 0;
    Object.assign(handle.viewport!.view, { x: 0, y: 0, s: 0.1 });
    handle.full!();
    assert.ok(page.canvases.some((c) => c.calls.some((call) => call.method === 'lineTo' && call.args[0] === 402 && call.args[1] === 300)), 'The selected stairs must remain visible below the base style’s minimum zoom');
  });
}

const texts = (page: { canvases: FakeCanvas[] }): unknown[] =>
  page.canvases.flatMap((c) => c.calls.filter((k) => k.method === 'fillText').map((k) => k.args[0]));

for (const [locale, riso, cyanotype] of [['en', 'LEGEND', 'SCALE'], ['es', 'LEYENDA', 'ESCALA']] as const) {
  for (const style of ['riso', 'cyanotype'] as const) {
    test(`${style} draws its Canvas text in ${locale}`, async (t) => {
      const page = await mountStyle(t, style, { locale, width: 1600, height: 800 });
      const printed = texts(page);
      assert.ok(printed.includes(style === 'riso' ? riso : cyanotype), `Expected ${style} furniture in ${locale}`);
      assert.ok(!printed.includes(style === 'riso' ? 'LÉGENDE' : 'ÉCHELLE'));
    });
  }
}

for (const style of ['riso', 'cyanotype'] as const) {
  test(`${style} prints the registry title instead of the place name`, async (t) => {
    const page = await mountStyle(t, style, { title: 'Mon quartier' });
    const printed = texts(page);
    assert.ok(printed.includes('MON QUARTIER'), 'The printed title must use the registry override');
    assert.ok(!printed.includes(osm.place.name.toUpperCase()));
  });
}

test('gravure-sepia letters its compass in the page language and prints the registry title as written', async (t) => {
  // Street names are drawn glyph by glyph, so single letters also come from them: compare
  // the same map in two languages.
  let en: unknown[] = [], es: unknown[] = [];
  await t.test('en', async (st) => { en = texts(await mountStyle(st, 'gravure-sepia', { locale: 'en', title: 'Mon quartier' })); });
  await t.test('es', async (st) => { es = texts(await mountStyle(st, 'gravure-sepia', { locale: 'es', title: 'Mon quartier' })); });
  const count = (all: unknown[], letter: string): number => all.filter((v) => v === letter).length;
  assert.equal(count(en, 'W') - count(es, 'W'), 1, 'The west point is lettered W in English');
  assert.equal(count(es, 'O') - count(en, 'O'), 1, 'The west point is lettered O in Spanish');
  assert.ok(en.includes('Mon quartier'), 'The cartouche must print the registry title');
});

/** Where each style puts the navigation group and the attribution, for the page size. */
const LAYOUTS = {
  riso: () => computeLayout(SIZE.width, SIZE.height),
  cyanotype: () => sheetLayout(SIZE.width, SIZE.height),
  'gravure-sepia': () => computeLayout(SIZE.width, SIZE.height),
  // Without subject the art deco legend has three rows: buildings, parks, water.
  'art-deco': () => decoLayout(SIZE.width, SIZE.height, 3),
} satisfies Record<keyof typeof STYLES, () => { nav: Rect; attr: Rect }>;

const inside = (r: Rect, x: number, y: number): boolean => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
/** A slot as names must avoid it: 4 CSS px wider on each side, in device px. */
const keepOut = (r: Rect): Rect => [(r[0] - 4) * DPR, (r[1] - 4) * DPR, (r[2] + 4) * DPR, (r[3] + 4) * DPR];

// Views (centre as a share of the survey half-side, px/m) that bring names into the
// top-left (navigation) and bottom-right (attribution) corners of an 800 × 600 page.
const VIEWS: [number, number, number][] = [[0, 0, 1], [0.3, -0.3, 1], [-0.3, 0.3, 1], [0.2, 0, 1], [0, 0, 2]];

for (const style of ALL) {
  test(`${style} places the HTML overlays on its layout's navigation and attribution slots`, async (t) => {
    const page = await mountStyle(t, style, { dpr: DPR });
    const { nav, attr } = LAYOUTS[style]();
    assert.deepEqual(page.placed.at(-1), {
      back: { left: nav[0], top: nav[1] },
      attribution: { right: SIZE.width - attr[2], bottom: SIZE.height - attr[3] },
    });
  });

  test(`${style} keeps map names out of the navigation and attribution slots`, async (t) => {
    const page = await mountStyle(t, style, { dpr: DPR });
    const { nav, attr } = LAYOUTS[style]();
    const half = osm.survey.half;
    const glyphs = page.canvases.flatMap((c) => nameGlyphs(c.calls));
    for (const [fx, fy, s] of VIEWS) {
      for (const c of page.canvases) c.calls.length = 0;
      Object.assign(page.handle.viewport!.view, { x: fx * half, y: fy * half, s });
      page.handle.full!();
      glyphs.push(...page.canvases.flatMap((c) => nameGlyphs(c.calls)));
    }
    assert.ok(glyphs.length > 1000, 'The views must print names');
    const hidden = glyphs.filter((g) => inside(keepOut(nav), g.x, g.y) || inside(keepOut(attr), g.x, g.y));
    assert.deepEqual(hidden, []);
  });
}

test('names come from the road and waterway layers, tunnels left out, with the usual weights', () => {
  const layers = osmLayersOf({
    roads: [
      { g: [0, 0, 50, 0], k: 'residential', n: 'Damrak' },
      { g: [0, 10, 50, 10], k: 'residential', n: 'Under', p: { tunnel: true } },
      { g: [0, 20, 50, 20], k: 'footway', n: 'Pad' },
    ],
    waterways: [
      { g: [0, 0, 0, 50], k: 'canal', n: 'Singel' },
      { g: [5, 0, 5, 50], k: 'canal', n: 'Buried', p: { tunnel: true } },
      { g: [9, 0, 9, 50], k: 'stream', n: 'Beek' },
    ],
  });
  const names = prepareLabels(layers);
  assert.deepEqual(names.streets.map((s) => s.name), ['Damrak']);
  assert.deepEqual(names.canals.map((c) => c.name), ['Singel']);
});
