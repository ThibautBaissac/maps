import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseMapData, type MapData } from '../src/data.ts';
import { DEFAULTS } from '../src/styles/cyanotype/defaults.ts';
import { prepareMap, renderMap } from '../src/styles/cyanotype/map.ts';
import { makeProjector } from '../src/toolkit/projection.ts';
import { recordingContext, type Call } from './dom.ts';
import * as thematic from '../src/toolkit/topic.ts';
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
  const topic = analyseTopic({ ...data, meta: { ...data.meta, half: 100 }, roads: [{ k: 'steps', n: 'Steps', p: [-30, 20, -10, 20] }] }, 'steps');
  const markers = thematic.placeTopicMarkers(topic, makeProjector({ x: 0, y: 0, s: 1 }, 200, 200, 1), {
    map: [0, 0, 200, 200], nav: [0, 0, 100, 100], attr: [180, 180, 200, 200], furniture: [],
  });
  assert.equal(markers.length, 1);
  assert.deepEqual(markers[0]?.anchor, [80, 80]);
  assert.ok(markers[0]!.x - 12 >= 100 || markers[0]!.y - 12 >= 100, 'The badge must clear the navigation');
});
