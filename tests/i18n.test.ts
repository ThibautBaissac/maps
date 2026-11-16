import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as i18n from '../src/i18n/index.ts';

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
