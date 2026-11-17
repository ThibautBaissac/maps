import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogueOf, findMap } from '../src/catalogue.ts';
import { galleryFilters, mapTags } from '../src/gallery/filters.ts';
import { isShown, parseTag } from '../src/gallery/selection.ts';
import type { MapEntry } from '../src/registry.ts';

const entry = (id: string, extra: Partial<MapEntry> = {}): MapEntry => ({ id, place: 'amsterdam-centre', style: 'riso', topic: 'canal-crossings', ...extra } as MapEntry);

test('a map is tagged with its place, its style and the themes of its subject', () => {
  assert.deepEqual(mapTags(findMap('londres-gravure-sepia')!), ['place:londres-soho', 'style:gravure-sepia', 'theme:history', 'theme:health', 'theme:water']);
});

test('only filters that keep some maps but not all of them are offered, labelled in the page language', () => {
  const maps = catalogueOf([
    entry('a'),
    entry('b', { style: 'cyanotype', topic: 'steps' }),
    entry('c', { place: 'lisbonne-alfama', style: 'cyanotype', topic: 'steps' }),
  ], 'en');
  const facets = galleryFilters(maps, 'en');
  assert.deepEqual(facets.map((f) => f.facet), ['place', 'style', 'theme']);
  assert.deepEqual(facets[0]!.filters, [
    { tag: 'place:amsterdam-centre', label: 'Amsterdam', count: 2 },
    { tag: 'place:lisbonne-alfama', label: 'Lisbon', count: 1 },
  ]);
  assert.deepEqual(facets[2]!.filters.map((f) => f.tag), ['theme:water', 'theme:relief']);
});

test('a facet whose every value covers all the maps is left out', () => {
  const facets = galleryFilters(catalogueOf([entry('a'), entry('b')], 'fr'), 'fr');
  assert.deepEqual(facets, []);
});

test('with no filter every map is shown; with one, only the maps that carry it', () => {
  const tags = ['place:londres-soho', 'theme:water'];
  assert.equal(isShown(tags, null), true);
  assert.equal(isShown(tags, 'theme:water'), true);
  assert.equal(isShown(tags, 'theme:relief'), false);
});

test('a tag read from the address is kept only when it is one of the offered filters', () => {
  const offered = ['theme:water', 'style:riso'];
  assert.equal(parseTag('?tag=theme%3Awater', offered), 'theme:water');
  assert.equal(parseTag('?tag=theme:water', offered), 'theme:water');
  assert.equal(parseTag('?tag=theme:fire', offered), null);
  assert.equal(parseTag('', offered), null);
});
