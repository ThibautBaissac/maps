import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMap } from '../src/catalogue.ts';
import { galleryHtml, metaDescription, pageHtml, sitemapXml } from '../scripts/pages.ts';

const SITE = 'https://example.test/atlas/';
const contentOf = (html: string, attr: string, name: string): string | undefined =>
  new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`).exec(html)?.[1];

test('a long text is cut to whole sentences within 160 characters', () => {
  const text = `${'a'.repeat(90)}. ${'b'.repeat(50)}. ${'c'.repeat(60)}.`;
  assert.equal(metaDescription(text), `${'a'.repeat(90)}. ${'b'.repeat(50)}.`);
});

test('a first sentence longer than 160 characters is cut at a word and ends with an ellipsis', () => {
  const cut = metaDescription(`${'word '.repeat(50)}end.`);
  assert.ok(cut.length <= 160);
  assert.match(cut, /word…$/);
});

test('a short text is kept whole', () => {
  assert.equal(metaDescription('Short. Text.'), 'Short. Text.');
});

test('a map page is titled by its question and place, and described within the length search engines show', () => {
  for (const locale of ['fr', 'en', 'es'] as const) for (const id of ['amsterdam-riso', 'lisbonne-cyanotype', 'londres-gravure-sepia']) {
    const map = findMap(id, locale)!;
    const html = pageHtml(map, locale, '/atlas/', SITE);
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? '';
    assert.ok(title.endsWith(` — ${map.title}, ${map.place.district}`), title);
    const description = contentOf(html, 'name', 'description') ?? '';
    assert.ok(description.length > 0 && description.length <= 160, `${id} ${locale}: ${description.length}`);
  }
  assert.match(pageHtml(findMap('londres-gravure-sepia', 'en')!, 'en', '/atlas/', SITE), /<title>Why do the 1854 cholera deaths in Soho gather around a single pump\? — London, Soho<\/title>/);
});

test('every page names the French version as the default language', () => {
  assert.match(galleryHtml('en', '/atlas/', SITE), /<link rel="alternate" hreflang="x-default" href="https:\/\/example.test\/atlas\/fr\/" \/>/);
  assert.match(pageHtml(findMap('amsterdam-riso', 'es')!, 'es', '/atlas/', SITE), /hreflang="x-default" href="https:\/\/example.test\/atlas\/fr\/cartes\/amsterdam-riso\/"/);
});

test('a shared map link shows its question, its description and its landscape picture', () => {
  const html = pageHtml(findMap('lisbonne-cyanotype', 'en')!, 'en', '/atlas/', SITE);
  assert.equal(contentOf(html, 'property', 'og:type'), 'article');
  assert.equal(contentOf(html, 'property', 'og:site_name'), 'Illustrated maps');
  assert.equal(contentOf(html, 'property', 'og:url'), `${SITE}en/cartes/lisbonne-cyanotype/`);
  assert.equal(contentOf(html, 'property', 'og:locale'), 'en_GB');
  assert.match(html, /<meta property="og:locale:alternate" content="fr_FR" \/>/);
  assert.match(contentOf(html, 'property', 'og:title') ?? '', /^Where do the streets of Alfama turn into stairs/);
  assert.equal(contentOf(html, 'property', 'og:description'), contentOf(html, 'name', 'description'));
  assert.equal(contentOf(html, 'property', 'og:image'), `${SITE}vignettes/en/lisbonne-cyanotype.jpg`);
  assert.equal(contentOf(html, 'property', 'og:image:width'), '1200');
  assert.equal(contentOf(html, 'property', 'og:image:height'), '630');
  assert.equal(contentOf(html, 'name', 'twitter:card'), 'summary_large_image');
});

test('a gallery is titled and described by the places it holds', () => {
  const html = galleryHtml('fr', '/atlas/', SITE);
  assert.match(html, /<title>Cartes illustrées — Amsterdam, Lisbonne et Londres<\/title>/);
  const description = contentOf(html, 'name', 'description') ?? '';
  assert.match(description, /Centre historique \(Amsterdam\), Alfama \(Lisbonne\) et Soho \(Londres\)/);
  assert.ok(description.length <= 160);
  assert.equal(contentOf(html, 'property', 'og:type'), 'website');
  assert.equal(contentOf(html, 'property', 'og:image'), `${SITE}vignettes/fr/amsterdam-riso.jpg`);
});

test('without a public site URL no absolute link is written', () => {
  const html = pageHtml(findMap('amsterdam-riso', 'fr')!, 'fr', '/atlas/');
  assert.doesNotMatch(html, /rel="canonical"|og:url|og:image/);
  assert.match(html, /<meta name="description"/);
});

test('the sitemap lists every gallery and map page once, each with its language versions', () => {
  const xml = sitemapXml(SITE, ['amsterdam-riso', 'lisbonne-cyanotype']);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /xmlns:xhtml="http:\/\/www.w3.org\/1999\/xhtml"/);
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, [
    `${SITE}fr/`, `${SITE}en/`, `${SITE}es/`,
    `${SITE}fr/cartes/amsterdam-riso/`, `${SITE}en/cartes/amsterdam-riso/`, `${SITE}es/cartes/amsterdam-riso/`,
    `${SITE}fr/cartes/lisbonne-cyanotype/`, `${SITE}en/cartes/lisbonne-cyanotype/`, `${SITE}es/cartes/lisbonne-cyanotype/`,
  ]);
  // Each URL lists fr, en, es and x-default.
  assert.equal([...xml.matchAll(/<xhtml:link rel="alternate"/g)].length, 9 * 4);
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="x-default" href="https:\/\/example.test\/atlas\/fr\/cartes\/amsterdam-riso\/" \/>/);
});
