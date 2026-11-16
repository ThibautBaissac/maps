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
  assert.match(html, /<title>Lisboa · Alfama/);
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
  assert.match(html, /<h1[^>]*>Où se concentrent les escaliers/);
  assert.match(html, /id="topic-panel"/);
  assert.match(galleryHtml('fr', '/maps/'), /Où franchit-on les canaux/);
  assert.match(pageHtml(findMap('amsterdam-riso', 'en')!, 'en', '/maps/'), /Where can you cross the canals/);
});
