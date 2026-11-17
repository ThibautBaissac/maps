import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findMap } from '../src/catalogue.ts';
import { galleryHtml, pageHtml } from '../scripts/pages.ts';
import { createServer } from 'vite';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('Vite adds the deployment base to gallery images exactly once in development', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'maps-vite-test-'));
  const server = await createServer({ configFile: false, cacheDir, base: '/maps/', server: { middlewareMode: true, ws: false, hmr: false, watch: null, preTransformRequests: false }, optimizeDeps: { noDiscovery: true } });
  t.after(async () => { await server.close(); await rm(cacheDir, { recursive: true, force: true }); });
  for (const locale of ['fr', 'en', 'es'] as const) {
    const html = await server.transformIndexHtml(`/${locale}/index.html`, galleryHtml(locale, '/maps/'));
    assert.ok(html.includes(`src="/maps/vignettes/${locale}/amsterdam-riso.webp"`));
    assert.ok(html.includes(`src="/maps/vignettes/${locale}/lisbonne-cyanotype.webp"`));
    assert.doesNotMatch(html, /\/maps\/maps\//);
  }
});

test('a static map page carries its language, translated controls, language links and canonical URL under the deployment base', () => {
  const html = pageHtml(findMap('lisbonne-cyanotype', 'es')!, 'es', '/atlas/', 'https://example.test/atlas/');
  assert.match(html, /<html lang="es">/);
  assert.match(html, /<title>[^<]* — Lisboa, Alfama<\/title>/);
  assert.match(html, /aria-label="Ampliar el plano \(\+\)"/);
  assert.match(html, /href="\/atlas\/es\/">← Todos los mapas/);
  assert.match(html, /href="\/atlas\/en\/cartes\/lisbonne-cyanotype\/" lang="en" hreflang="en"/);
  assert.match(html, /rel="canonical" href="https:\/\/example.test\/atlas\/es\/cartes\/lisbonne-cyanotype\/"/);
  assert.match(html, /hreflang="fr" href="https:\/\/example.test\/atlas\/fr\/cartes\/lisbonne-cyanotype\/"/);
  assert.doesNotMatch(html, /Chargement|Toutes les cartes|Agrandir|Fermer|contributeurs/);
});

test('translated HTML escapes custom titles in metadata and attributes', () => {
  const map = { ...findMap('amsterdam-riso', 'en')!, title: '<script>"&' };
  const html = pageHtml(map, 'en', '/maps/');
  assert.match(html, /&lt;script&gt;&quot;&amp;/);
  assert.doesNotMatch(html, /<script>"&/);
});

test('each static gallery contains translated map names and links before JavaScript runs', () => {
  for (const [locale, city, open] of [['fr', 'Lisbonne', 'Ouvrir la carte'], ['en', 'Lisbon', 'Open map'], ['es', 'Lisboa', 'Abrir el mapa']] as const) {
    const html = galleryHtml(locale, '/atlas/');
    assert.ok(html.includes(`<html lang="${locale}">`));
    assert.ok(html.includes(`<span class="name">${city}</span>`));
    assert.ok(html.includes(open));
    assert.ok(html.includes(`href="/atlas/${locale}/cartes/lisbonne-cyanotype/"`));
    // Vite adds the deployment base to public assets in both dev and build.
    assert.ok(html.includes(`src="/vignettes/${locale}/lisbonne-cyanotype.webp"`));
    assert.ok(html.includes(`lang="${locale}" hreflang="${locale}" aria-current="page"`));
  }
});

test('the validated subjects appear in map headings and gallery cards before JavaScript runs', () => {
  const map = findMap('lisbonne-cyanotype', 'fr')!;
  const html = pageHtml(map, 'fr', '/maps/');
  assert.match(html, /<h1[^>]*>Où les rues de l’Alfama deviennent-elles des escaliers/);
  assert.match(html, /id="topic-panel"/);
  assert.match(galleryHtml('fr', '/maps/'), /Où passer d’une rive à l’autre/);
  assert.match(pageHtml(findMap('amsterdam-riso', 'en')!, 'en', '/maps/'), /Where can you get from one bank to the other/);
});

test('map navigation precedes the drawing while zoom and description stay with the map', () => {
  for (const locale of ['fr', 'en', 'es'] as const) for (const id of ['amsterdam-riso', 'lisbonne-cyanotype']) {
    const html = pageHtml(findMap(id, locale)!, locale, '/maps/');
    const header = /<header\b[^>]*>([\s\S]*?)<\/header>/.exec(html)?.[1] ?? '';
    const workspace = /<main\b[^>]*>([\s\S]*?)<\/main>/.exec(html)?.[1] ?? '';
    assert.match(header, /class="back"/);
    assert.match(header, /class="languages"/);
    assert.ok(html.indexOf('</header>') < html.indexOf('<main'));
    assert.doesNotMatch(workspace, /class="back"|class="languages"/);
    assert.match(workspace, /class="zoom-in"/);
    assert.match(workspace, /class="description-button"/);
  }
});

test('the attribution line adds the credits of the external layers after the OpenStreetMap link', () => {
  const map = { ...findMap('amsterdam-riso', 'fr')!, attributions: ['© Ville d’Amsterdam', '<b>&'] };
  const html = pageHtml(map, 'fr', '/maps/');
  assert.match(html, /<small class="attribution"><a href="https:\/\/www\.openstreetmap\.org\/copyright" target="_blank" rel="noopener">© contributeurs OpenStreetMap<\/a> · © Ville d’Amsterdam · &lt;b&gt;&amp;<\/small>/);
});

test('without layers the attribution line is the OpenStreetMap link alone', () => {
  const html = pageHtml(findMap('amsterdam-riso', 'fr')!, 'fr', '/maps/');
  assert.ok(html.includes('<small class="attribution"><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contributeurs OpenStreetMap</a></small>'));
});

test('the question and intro belong to the map, while the legend comes from its subject', () => {
  // Same subject as amsterdam-riso, published under another registered id.
  const map = { ...findMap('amsterdam-riso', 'en')!, id: 'lisbonne-cyanotype' };
  const html = pageHtml(map, 'en', '/maps/');
  assert.match(html, /<h1>Where do the streets of Alfama turn into stairs/);
  assert.match(html, /Thick lines with a paper border: bridge segments crossing a canal/);
});

test('a map without its question and intro in the dictionaries fails page generation and names the map', () => {
  const map = { ...findMap('amsterdam-riso', 'fr')!, id: 'sans-texte' };
  assert.throws(() => pageHtml(map, 'fr', '/maps/'), /No question and intro for map "sans-texte" in fr/);
});

test('the static gallery tags each strip and offers its filters hidden until the script runs', () => {
  const html = galleryHtml('en', '/maps/');
  assert.match(html, /<li class="strip[^"]*" data-tags="place:londres-soho style:gravure-sepia theme:history theme:health theme:water"/);
  assert.match(html, /<div class="filters" role="group" aria-label="Filter the maps" hidden>/);
  assert.match(html, /<button type="button" data-tag="" aria-pressed="true">All<\/button>/);
  assert.match(html, /<button type="button" data-tag="theme:water" aria-pressed="false">Water<\/button>/);
  assert.match(html, /<p class="filter-count" role="status" data-forms="\{&quot;one&quot;:&quot;\{count\} map shown&quot;,&quot;other&quot;:&quot;\{count\} maps shown&quot;\}"><\/p>/);
});
