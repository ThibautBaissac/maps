// Both styles driven through their real mount(), on a fake page (tests/dom.ts).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseMapData } from '../src/data.ts';
import type { MapHandle, MountArgs } from '../src/styles/contract.ts';
import { sheetLayout } from '../src/styles/cyanotype/sheet.ts';
import type { Rect } from '../src/toolkit/geometry.ts';
import { computeLayout } from '../src/toolkit/layout.ts';
import { installPage, nameGlyphs, type FakeCanvas } from './dom.ts';
import type { Locale } from '../src/i18n/index.ts';
import { analyseTopic } from '../src/topics.ts';

const data = parseMapData(JSON.parse(readFileSync(new URL('../public/data/amsterdam-centre.json', import.meta.url), 'utf8')), 'fixture');
const SIZE = { width: 800, height: 600 };
/** Pixel density of the overlay tests: device px differ from CSS px, as on most screens. */
const DPR = 2;

const STYLES = {
  riso: () => import('../src/styles/riso/index.ts'),
  cyanotype: () => import('../src/styles/cyanotype/index.ts'),
} as const;

async function mountStyle(t: Parameters<typeof installPage>[0], style: keyof typeof STYLES, { title = 'Mon quartier', dpr = 1, locale = 'fr' as Locale, width = SIZE.width, height = SIZE.height } = {}) {
  const page = installPage(t, { width, height, dpr });
  const { mount } = await STYLES[style]();
  const { name: _, ...meta } = data.meta;
  const args: MountArgs<object> = { container: page.container, data, meta: { ...meta, title }, locale, options: {}, shell: page.shell, layers: [] };
  const handle: MapHandle = await (mount as (a: MountArgs<object>) => Promise<MapHandle>)(args);
  page.cleanup(() => handle.destroy());
  return { ...page, handle };
}

// The stage's own sequence: clear, paper, then the map buffer clipped to the map window
// and re-projected (clip, setTransform, drawImage).
for (const style of ['riso', 'cyanotype'] as const) {
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

for (const style of ['riso', 'cyanotype'] as const) {
  test(`${style} shows the subject's stairs even at the overview zoom`, async (t) => {
    const page = installPage(t, SIZE);
    const map = { ...data, roads: [{ k: 'steps' as const, n: 'Escadinhas', p: [-20, 0, 20, 0] }], buildings: [], parks: [], waterways: [], water: [] };
    const { name: _, ...meta } = map.meta;
    const { mount } = await STYLES[style]();
    const handle = await mount({ container: page.container, shell: page.shell, data: map, meta: { ...meta, title: 'Test' }, options: {}, locale: 'fr', layers: [], topic: analyseTopic(map, 'steps') });
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
    assert.ok(!printed.includes(data.meta.name.toUpperCase()));
  });
}

/** Where each style puts the navigation group and the attribution, for the page size. */
const LAYOUTS = {
  riso: () => computeLayout(SIZE.width, SIZE.height),
  cyanotype: () => sheetLayout(SIZE.width, SIZE.height),
} satisfies Record<keyof typeof STYLES, () => { nav: Rect; attr: Rect }>;

const inside = (r: Rect, x: number, y: number): boolean => x >= r[0] && x <= r[2] && y >= r[1] && y <= r[3];
/** A slot as names must avoid it: 4 CSS px wider on each side, in device px. */
const keepOut = (r: Rect): Rect => [(r[0] - 4) * DPR, (r[1] - 4) * DPR, (r[2] + 4) * DPR, (r[3] + 4) * DPR];

// Views (centre as a share of the survey half-side, px/m) that bring names into the
// top-left (navigation) and bottom-right (attribution) corners of an 800 × 600 page.
const VIEWS: [number, number, number][] = [[0, 0, 1], [0.3, -0.3, 1], [-0.3, 0.3, 1], [0.2, 0, 1], [0, 0, 2]];

for (const style of ['riso', 'cyanotype'] as const) {
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
    const half = data.meta.half;
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
