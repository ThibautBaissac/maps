import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as i18n from '../src/i18n/index.ts';
import { mapStory, storyProblems } from '../src/i18n/stories.ts';

test('numbers and coordinates follow the selected language', () => {
  assert.equal(typeof i18n.formatNumber, 'function');
  assert.equal(i18n.formatNumber('en', 1234.5), '1,234.5');
  assert.equal(i18n.formatNumber('es', 12.5), '12,5');
  assert.equal(i18n.formatCoordinate('fr', -9.1284, 'lon', 2), '9,13°O');
  assert.equal(i18n.formatCoordinate('en', -9.1284, 'lon', 2), '9.13°W');
});

test('survey dates keep their UTC calendar day in every language', () => {
  assert.equal(typeof i18n.formatDate, 'function');
  assert.equal(i18n.formatDate('fr', '2026-01-02T00:30:00Z'), '02/01/2026');
  assert.equal(i18n.formatDate('en', '2026-01-02T00:30:00Z'), '02/01/2026');
  assert.equal(i18n.formatDate('es', '2026-01-02T00:30:00Z'), '02/01/2026');
});

test('feature counts use the language plural rules, including zero', () => {
  assert.equal(typeof i18n.featureCount, 'function');
  assert.equal(i18n.featureCount('fr', 0, 0), '0 bâtiment');
  assert.equal(i18n.featureCount('en', 0, 0), '0 buildings');
  assert.equal(i18n.featureCount('es', 0, 1), '1 edificio');
  assert.equal(i18n.featureCount('es', 0, 2), '2 edificios');
});

test('translation validation names missing and empty messages instead of hiding them with a fallback', () => {
  assert.equal(typeof i18n.translationProblems, 'function');
  const catalogues = { fr: i18n.messages('fr'), en: { ...i18n.messages('en'), map: { retry: '' } }, es: i18n.messages('es') };
  const problems = i18n.translationProblems(catalogues);
  assert.ok(problems.includes('en.map.retry: empty translation'));
  assert.ok(problems.includes('en.map.loading: missing or invalid translation'));
  assert.deepEqual(i18n.translationProblems(), []);
});

test('numbered references follow the punctuation of each language in the text description', () => {
  assert.equal(i18n.messages('en').topic.referenceLine('1', 'Broad Street pump', '3 deaths'), '1. Broad Street pump: 3 deaths');
  assert.equal(i18n.messages('fr').topic.referenceLine('1', 'Pompe de Broad Street', '3 décès'), '1. Pompe de Broad Street : 3 décès');
});

test('story validation names a map whose question or intro is missing in a language', () => {
  const stories = Object.fromEntries(['amsterdam-riso', 'lisbonne-cyanotype', 'londres-gravure-sepia', 'new-york-art-deco', 'france-dossier']
    .map((id) => [id, Object.fromEntries(i18n.LOCALES.map((l) => [l, mapStory(l, id)]))]));
  assert.deepEqual(storyProblems(), []);
  const amsterdam = stories['amsterdam-riso']!;
  assert.deepEqual(storyProblems({ ...stories, 'amsterdam-riso': { ...amsterdam, de: { question: 'Wo?', intro: ' ' } } }), ['de.maps.amsterdam-riso.intro: empty translation']);
});

test('a dictionary not loaded is named rather than read as missing texts', async () => {
  const { messages } = await import(`../src/i18n/index.ts?isolated=${Date.now()}`) as typeof i18n;
  assert.throws(() => messages('pt'), /No pt dictionary loaded: import src\/i18n\/pt\.ts first/);
});
