import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Feature, Layer, Line } from '../src/layers.ts';
import { LOCALES } from '../src/i18n/index.ts';
import * as topics from '../src/topics/all.ts';
import { osmLayersOf } from './osm-file.ts';

const survey = { half: 10 };
const map = (roads: Feature<Line>[], waterways: Feature<Line>[] = []): Layer[] => osmLayersOf({ roads, waterways });

test('the stairs subject measures only stair geometry inside the survey, splitting its length across sectors', () => {
  assert.equal(typeof topics.analyseTopic, 'function');
  const layers = map([
    { g: [-20, 0, 20, 0], k: 'steps', n: 'Escadinhas' },
    { g: [-10, 1, 10, 1], k: 'residential' },
    { g: [20, 20, 25, 25], k: 'steps' },
    { g: [-5, 1, 5, 1], k: 'steps', p: { tunnel: true } },
  ]);
  const result = topics.analyseTopic(survey, layers, 'steps');
  assert.equal(result.length, 20);
  assert.deepEqual(result.segments.map((f) => f.g), [[-10, 0, 10, 0]]);
  assert.equal(result.sectors.length, 9);
  assert.ok(Math.abs(result.sectors.reduce((sum, s) => sum + s.length, 0) - 20) < 1e-9);
  assert.ok(Math.abs(result.sectors[4]!.length - 20 / 3) < 1e-9);
  assert.equal(result.places[0]?.name, 'Escadinhas');
  assert.deepEqual(result.places[0]?.point, [0, 0]);
});

test('the canals subject requires a bridge crossing a surface canal inside the survey', () => {
  const layers = map([
    { g: [-5, -2, 5, -2], k: 'residential', n: 'Bridge', p: { bridge: true } },
    { g: [-5, -1, 5, -1], k: 'cycleway', n: 'Bridge', p: { bridge: true } },
    { g: [-5, 0, 5, 0], k: 'residential', n: 'No bridge tag' },
    { g: [2, 2, 8, 2], k: 'footway', n: 'Over a road', p: { bridge: true } },
    { g: [-1, -1, 1, -1], k: 'steps' },
    { g: [-5, 1, 5, 1], k: 'residential', p: { bridge: true, tunnel: true } },
    { g: [5, 4, 25, 4], k: 'residential', n: 'Outside crossing', p: { bridge: true } },
    { g: [5, 6, 9, 6], k: 'residential', n: 'Culvert', p: { bridge: true } },
  ], [
    { g: [0, -10, 0, 10], k: 'canal', n: 'Canal' },
    { g: [20, -10, 20, 10], k: 'canal', n: 'Outside' },
    { g: [7, 5, 7, 9], k: 'canal', n: 'Covered', p: { tunnel: true } },
  ]);
  const result = topics.analyseTopic(survey, layers, 'canal-crossings');
  assert.deepEqual(result.segments.map((f) => f.n), ['Bridge', 'Bridge']);
  assert.equal(result.length, 20);
  assert.deepEqual(result.canals, ['Canal']);
  assert.equal(result.places.length, 1, 'Named segments group into a reference, never a physical-bridge count');
  assert.equal(result.places[0]?.length, 20);
  assert.deepEqual(result.places[0]?.waters, ['Canal']);
  assert.equal(result.sectors.reduce((sum, s) => sum + s.length, 0), 20);
});

test('empty thematic data produces zero measurements and no invented references', () => {
  const result = topics.analyseTopic(survey, map([]), 'steps');
  assert.equal(result.length, 0);
  assert.deepEqual(result.places, []);
  assert.ok(result.sectors.every((s) => s.length === 0));
});

test('every registered subject analyses to the id it is registered under, so its text is found again', () => {
  for (const id of topics.TOPIC_IDS) {
    assert.equal(topics.analyseTopic(survey, map([]), id).id, id);
    assert.ok(topics.themesOf(id).length > 0, `${id} has no gallery theme`);
  }
});

test('translation validation names a missing text of a subject, in its folder', () => {
  const { metric: _, ...steps } = topics.topicText('en', 'steps');
  const texts: Record<string, Record<string, unknown>> = Object.fromEntries(topics.TOPIC_IDS.map((id) => [id, Object.fromEntries(LOCALES.map((l) => [l, topics.topicText(l, id)]))]));
  texts['steps'] = { ...texts['steps'], en: steps };
  assert.deepEqual(topics.topicTranslationProblems(), []);
  assert.deepEqual(topics.topicTranslationProblems(texts as Record<topics.TopicId, unknown>), ['en.topics.steps.metric: missing or invalid translation']);
});

test('a map page loads its subject on demand, with the same code as Node', async () => {
  for (const id of topics.TOPIC_IDS) {
    const def = await topics.loadTopic(id);
    assert.equal(def.analyse(survey, map([])).id, id);
  }
});

test('a subject not loaded yet is named rather than drawn as nothing', async () => {
  const { loadedTopic } = await import(`../src/topics/index.ts?isolated=${Date.now()}`) as typeof topics;
  assert.throws(() => loadedTopic('steps'), /Subject "steps" is not loaded: await loadTopic\('steps'\) first/);
});
