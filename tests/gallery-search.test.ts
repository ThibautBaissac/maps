import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapsForLocale } from '../src/catalogue.ts';
import { searchDocuments } from '../src/gallery/search-index.ts';
import { createSearch, parseQuery } from '../src/gallery/search.ts';

const searchIn = (locale: 'fr' | 'en' | 'de') => createSearch(searchDocuments(mapsForLocale(locale), locale));
const ids = (found: ReadonlySet<string> | null): string[] | null => (found ? [...found].sort() : null);

test('each map is indexed with its title, place, style, subject question and themes in the page language', () => {
  const doc = searchDocuments(mapsForLocale('en'), 'en').find((d) => d.id === 'londres-gravure-sepia');
  assert.ok(doc);
  assert.equal(doc.place, 'London');
  assert.match(doc.question, /cholera/);
  assert.match(doc.themes, /Health/);
});

test('an empty or blank query keeps every map', () => {
  const search = searchIn('fr');
  assert.equal(search(''), null);
  assert.equal(search('   '), null);
});

test('a query ignores accents and case', () => {
  const search = searchIn('fr');
  assert.deepEqual(ids(search('CHOLÉRA')), ['londres-gravure-sepia']);
  assert.deepEqual(ids(search('cholera')), ['londres-gravure-sepia']);
});

test('a word being typed matches by its beginning', () => {
  assert.deepEqual(ids(searchIn('fr')('esca')), ['lisbonne-cyanotype']);
});

test('a small typo still finds the map', () => {
  assert.deepEqual(ids(searchIn('fr')('lisbone')), ['lisbonne-cyanotype']);
});

test('every word of the query must match the same map', () => {
  const search = searchIn('fr');
  assert.deepEqual(ids(search('pompe soho')), ['londres-gravure-sepia']);
  assert.deepEqual(ids(search('pompe amsterdam')), []);
});

test('the index follows the page language', () => {
  assert.deepEqual(ids(searchIn('en')('stairs')), ['lisbonne-cyanotype']);
  assert.deepEqual(ids(searchIn('fr')('stairs')), []);
});

test('a query is read from ?q= of the address, trimmed', () => {
  assert.equal(parseQuery('?q=%20soho%20'), 'soho');
  assert.equal(parseQuery('?tag=style:riso'), '');
  assert.equal(parseQuery(''), '');
});
