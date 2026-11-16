import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { parseMapData, type MapData } from '../src/data.ts';
import { DEFAULTS } from '../src/styles/cyanotype/defaults.ts';
import { prepareMap, renderMap } from '../src/styles/cyanotype/map.ts';
import { preparePlates, renderPlateA, renderPlateB } from '../src/styles/riso/plates.ts';
import { makeProjector } from '../src/toolkit/projection.ts';
import { installPage, recordingContext, type Call } from './dom.ts';
import type { Layer } from '../src/layers.ts';
import { drawLayers } from '../src/toolkit/layers.ts';
import * as thematic from '../src/toolkit/topic.ts';
import { osmLayers } from '../src/osm-layers.ts';
import { analyseTopic } from '../src/topics.ts';

const data = parseMapData(JSON.parse(readFileSync(new URL('../public/data/amsterdam-centre.json', import.meta.url), 'utf8')), 'fixture');

// Record the Canvas browser API's output; all map preparation and rendering stays real.
function canvas() {
  const calls: Call[] = [];
  return { ctx: recordingContext({ width: 320, height: 640 }, calls), calls };
}

test('cyanotype draws a residential bridge when zoomed out to a single line', (t) => {
  const original = globalThis.Path2D;
  globalThis.Path2D = class {} as typeof Path2D;
  t.after(() => {
    if (original) globalThis.Path2D = original;
    else Reflect.deleteProperty(globalThis, 'Path2D');
  });
  const map: MapData = {
    meta: data.meta, buildings: [], water: [], waterways: [], parks: [],
    roads: [{ k: 'residential', p: [-10, 0, 10, 0], b: 1 }],
  };
  const out = canvas(), tmp = canvas();
  const view = { x: 0, y: 0, s: 0.2 };
  renderMap(out.ctx, tmp.ctx, prepareMap(map), makeProjector(view, 320, 640, 1), DEFAULTS, {} as CanvasPattern);
  assert.ok(out.calls.some((c) => c.method === 'lineTo' && c.args[0] === 162 && c.args[1] === 320),
    'The bridge must reach its projected endpoint at low zoom');
});

test('numbered references move clear of navigation with their anchor preserved on the feature', () => {
  assert.equal(typeof thematic.placeTopicMarkers, 'function');
  const topic = analyseTopic({ half: 100 }, osmLayers({ ...data, meta: { ...data.meta, half: 100 }, roads: [{ k: 'steps', n: 'Steps', p: [-30, 20, -10, 20] }] }), 'steps');
  const markers = thematic.placeTopicMarkers(topic, makeProjector({ x: 0, y: 0, s: 1 }, 200, 200, 1), {
    map: [0, 0, 200, 200], nav: [0, 0, 100, 100], attr: [180, 180, 200, 200], furniture: [],
  });
  assert.equal(markers.length, 1);
  assert.deepEqual(markers[0]?.anchor, [80, 80]);
  assert.ok(markers[0]!.x - 12 >= 100 || markers[0]!.y - 12 >= 100, 'The badge must clear the navigation');
});

// External layers: the generic overlay drawing of the toolkit.
const INK = { stroke: '#112233', fill: '#ffffff', width: 1.5, radius: 4 };
const layer = <K extends Layer['kind']>(kind: K, g: unknown, extra: Partial<Layer> = {}): Layer =>
  ({ id: 'test', kind, role: 'overlay', attribution: '© test', source: 'layers/test.geojson', features: [{ g }], ...extra }) as Layer;
function drawn(layers: readonly Layer[], dpr = 1): Call[] {
  const out = canvas();
  drawLayers(out.ctx, makeProjector({ x: 0, y: 0, s: 1 }, 200, 200, dpr), layers, INK);
  return out.calls;
}
const methods = (calls: readonly Call[]): string[] => calls.map((c) => c.method);

test('a point layer draws a filled, outlined circle at the projected point', () => {
  const calls = drawn([layer('points', [0, 0])]);
  assert.deepEqual(calls.find((c) => c.method === 'arc')?.args, [100, 100, 4, 0, 2 * Math.PI]);
  assert.ok(methods(calls).includes('fill') && methods(calls).includes('stroke'));
});

test('a line layer strokes a straight polyline', () => {
  const calls = drawn([layer('lines', [-10, 0, 10, 0])]);
  const names = methods(calls);
  const move = names.indexOf('moveTo');
  assert.deepEqual(calls[move]?.args, [90, 100]);
  assert.deepEqual(calls[move + 1]?.args, [110, 100]);
  assert.equal(names[move + 1], 'lineTo');
  assert.ok(names.indexOf('stroke') > move + 1);
});

test('an area layer closes its rings, fills then outlines them', () => {
  const names = methods(drawn([layer('areas', [[-10, -10, 10, -10, 10, 10, -10, 10]])]));
  assert.ok(names.includes('closePath'));
  assert.ok(names.indexOf('fill') > names.indexOf('closePath'));
  assert.ok(names.lastIndexOf('stroke') > names.indexOf('fill'));
});

test('an area layer fills even-odd, so a hole wound like its ring stays empty', () => {
  const outer = [-10, -10, 10, -10, 10, 10, -10, 10];
  const hole = [-5, -5, 5, -5, 5, 5, -5, 5];
  const fills = drawn([layer('areas', [outer, hole])]).filter((c) => c.method === 'fill');
  assert.equal(fills.length, 1);
  assert.deepEqual(fills[0]?.args, ['evenodd']);
});

test('objects off screen and empty layer lists draw nothing', () => {
  for (const calls of [drawn([layer('points', [5000, 0])]), drawn([layer('lines', [5000, 0, 5010, 0])]), drawn([])]) {
    assert.deepEqual(methods(calls).filter((m) => ['arc', 'moveTo', 'lineTo', 'fill', 'stroke'].includes(m)), []);
  }
});

test('the point radius is in CSS px, scaled by the pixel density', () => {
  assert.equal(drawn([layer('points', [0, 0])], 2).find((c) => c.method === 'arc')?.args[2], 8);
});

test('the context state is saved and restored around the layers', () => {
  const names = methods(drawn([layer('points', [0, 0])]));
  assert.equal(names[0], 'save');
  assert.equal(names.at(-1), 'restore');
});

// The digest is the pre-layers baseline: re-record it after any intentional change to a style's drawing.
// Digest of every canvas call of a mount with the OpenStreetMap layers only, recorded from the
// styles as they were before they drew layers: a map without external layers must stay as it was.
function digest(calls: readonly Call[]): string {
  const h = createHash('sha1');
  for (const c of calls) h.update(JSON.stringify([c.method, c.args.map((a) => (typeof a === 'number' || typeof a === 'string' || typeof a === 'boolean' ? a : typeof a))]));
  return h.digest('hex');
}
const BASELINE: Record<string, string> = { riso: 'f35ab5f59f01e75f1546ebc0f64cbafc5076692a', cyanotype: '1b9cacefa6f2532505bf059614d2059cdaeb413a' };
for (const style of ['riso', 'cyanotype'] as const) {
  test(`${style} makes the same canvas calls as before layers existed when the map has no external layer`, async (t) => {
    const page = installPage(t, { width: 800, height: 600 });
    const { mount } = await import(`../src/styles/${style}/index.ts`) as { mount: (a: never) => Promise<{ destroy(): void }> };
    const { name: _, ...meta } = data.meta;
    const handle = await mount({ container: page.container, data, meta: { ...meta, title: 'Test' }, locale: 'fr', options: {}, shell: page.shell, layers: osmLayers(data) } as never);
    page.cleanup(() => handle.destroy());
    assert.equal(digest(page.canvases.flatMap((c) => c.calls)), BASELINE[style]);
  });
}

// Each style must draw the layers it is given, on its own canvas: the point at the square's
// centre lands in the middle of the 800 × 600 stage. Canvas indices follow creation order
// (riso: plate B; cyanotype: the map).
const LAYERED_CANVAS = { riso: 5, cyanotype: 1 } as const;
for (const style of ['riso', 'cyanotype'] as const) {
  test(`${style} draws an overlay point layer at its projected point`, async (t) => {
    const page = installPage(t, { width: 800, height: 600 });
    const { mount } = await import(`../src/styles/${style}/index.ts`) as { mount: (a: never) => Promise<{ destroy(): void }> };
    const { name: _, ...meta } = data.meta;
    const layers = [...osmLayers(data), layer('points', [0, 0])];
    const handle = await mount({ container: page.container, data, meta: { ...meta, title: 'Test' }, locale: 'fr', options: {}, shell: page.shell, layers } as never);
    page.cleanup(() => handle.destroy());
    const arcs = page.canvases[LAYERED_CANVAS[style]]?.calls.filter((c) => c.method === 'arc' && c.args[2] === 4) ?? [];
    assert.deepEqual(arcs.map((c) => c.args.slice(0, 3)), [[400, 300, 4]]);
  });
}

// Riso plates on a small fixture: a bridge, a tunnel, a stream, a canal, a lake, a park and a house.
// The digest was recorded when the plates were still prepared from the map data and matched
// the sequence drawn from layers: it guards the drawing of the plates.
const SMALL: MapData = {
  meta: data.meta,
  buildings: [[[-30, -30, -10, -30, -10, -10, -30, -10, -30, -30]]],
  roads: [
    { k: 'residential', n: 'A', p: [-50, 0, 50, 0] },
    { k: 'primary', p: [0, -50, 0, 50], b: 1 },
    { k: 'footway', p: [-40, 20, 40, 20], u: 1 },
    { k: 'steps', p: [-40, 30, 40, 30] },
  ],
  waterways: [{ k: 'canal', p: [-45, -20, 45, -20] }, { k: 'stream', p: [-45, 10, 45, 10] }, { k: 'ditch', p: [-45, 12, 45, 12], u: 1 }],
  water: [{ r: [[20, 20, 40, 20, 40, 40, 20, 40, 20, 20]] }],
  parks: [{ k: 'park', r: [[-40, 25, -20, 25, -20, 45, -40, 45, -40, 25]] }],
};
test('riso plates drawn from layers keep their recorded canvas calls', () => {
  const plates = preparePlates(osmLayers(SMALL));
  const calls = [0.5, 2.5].flatMap((s) => {
    const out = canvas();
    const P = makeProjector({ x: 0, y: 0, s }, 320, 640, 1);
    renderPlateA(out.ctx, plates, P, '#111');
    renderPlateB(out.ctx, plates, P, '#222', { lines: '#333', dots: '#444' } as never);
    return out.calls;
  });
  assert.ok(calls.length > 100, 'the recorded sequence is not empty');
  assert.equal(digest(calls), '41d4b63b13cd370440a59023ef990fdaeae8cf3a');
});
