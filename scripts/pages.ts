// Static HTML shared by development and production builds.
import '../src/i18n/all.ts';
import { mapsForLocale, PAGES_DIR, type CatalogueMap } from '../src/catalogue.ts';
import { searchDocuments } from '../src/gallery/search-index.ts';
import { topicText } from '../src/topics/all.ts';
import { mapStory } from '../src/i18n/stories.ts';
import { DEFAULT_LOCALE, formatCoordinate, formatList, LOCALES, messages, ogLocale, pluralText, type Locale, type MapStory } from '../src/i18n/index.ts';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
const pathFor = (locale: Locale, map?: CatalogueMap): string => map ? `${locale}/${PAGES_DIR}/${map.id}/` : `${locale}/`;

const CHEVRON = '<svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';

/** A disclosure: the current language shows, the others open below it. Works without JavaScript; src/languages.ts adds Escape and outside clicks. */
function languageNav(locale: Locale, base: string, map?: CatalogueMap): string {
  const links = LOCALES.map((target) =>
    `<li><a href="${esc(base + pathFor(target, map))}" lang="${target}" hreflang="${target}"${target === locale ? ' aria-current="page"' : ''}>${esc(messages(target).languageName)}</a></li>`).join('');
  return `<nav class="languages" aria-label="${esc(messages(locale).languageNav)}"><details><summary><span lang="${locale}">${esc(messages(locale).languageName)}</span>${CHEVRON}</summary><ul>${links}</ul></details></nav>`;
}

/** Longest meta description search engines show in full. */
const DESCRIPTION_MAX = 160;
/** Longest gallery title kept whole: search engines cut longer ones. */
const TITLE_MAX = 70;

/** `items` as a sentence list when `fits` accepts it; otherwise its longest start that does, ending with the count of the rest (« Amsterdam, Lisbonne et 12 autres »). */
export function boundedList(locale: Locale, items: readonly string[], fits: (list: string) => boolean): string {
  const all = formatList(locale, items);
  if (fits(all) || items.length < 2) return all;
  const cut = (k: number): string => formatList(locale, [...items.slice(0, k), pluralText(locale, messages(locale).gallery.more, items.length - k)]);
  for (let k = items.length - 1; k > 1; k--) if (fits(cut(k))) return cut(k);
  return cut(1);
}

/** Whole sentences within `max` characters; a first sentence too long is cut at a word, with an ellipsis. */
export function metaDescription(text: string, max = DESCRIPTION_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  let kept = '';
  for (const sentence of clean.match(/[^.!?…]+[.!?…]+["»”’)]*\s*|[^.!?…]+$/g) ?? []) {
    if ((kept + sentence).trimEnd().length > max) break;
    kept += sentence;
  }
  if (kept.trim()) return kept.trimEnd();
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '')}…`;
}

const SHARE_SIZE = { width: 1200, height: 630 };

const absoluteUrl = (siteUrl: string, path: string): string => new URL(path, siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`).href;

interface Seo {
  title: string;
  description: string;
  type: 'website' | 'article';
  /** Relative to the site root: the page in the current language. */
  image: string;
  imageAlt: string;
}

/** Canonical, language versions and link previews; nothing when the public origin is unknown (local preview). */
function seoTags(locale: Locale, siteUrl: string | undefined, seo: Seo, map?: CatalogueMap): string {
  if (!siteUrl) return '';
  const absolute = (path: string): string => esc(absoluteUrl(siteUrl, path));
  const meta = (attr: 'property' | 'name', name: string, content: string): string => `<meta ${attr}="${name}" content="${esc(content)}" />`;
  return [
    `<link rel="canonical" href="${absolute(pathFor(locale, map))}" />`,
    ...LOCALES.map((target) => `<link rel="alternate" hreflang="${target}" href="${absolute(pathFor(target, map))}" />`),
    `<link rel="alternate" hreflang="x-default" href="${absolute(pathFor(DEFAULT_LOCALE, map))}" />`,
    meta('property', 'og:type', seo.type),
    meta('property', 'og:site_name', messages(locale).gallery.title),
    meta('property', 'og:title', seo.title),
    meta('property', 'og:description', seo.description),
    `<meta property="og:url" content="${absolute(pathFor(locale, map))}" />`,
    meta('property', 'og:locale', ogLocale(locale)),
    ...LOCALES.filter((target) => target !== locale).map((target) => meta('property', 'og:locale:alternate', ogLocale(target))),
    `<meta property="og:image" content="${absolute(seo.image)}" />`,
    meta('property', 'og:image:width', String(SHARE_SIZE.width)),
    meta('property', 'og:image:height', String(SHARE_SIZE.height)),
    meta('property', 'og:image:alt', seo.imageAlt),
    meta('name', 'twitter:card', 'summary_large_image'),
  ].join('\n    ');
}

/** Every gallery and map page, in each language, with its language versions. Legacy /cartes/ URLs are left out: their canonical is the French page. */
export function sitemapXml(siteUrl: string, mapIds: readonly string[]): string {
  const paths = (id?: string): Record<Locale, string> =>
    Object.fromEntries(LOCALES.map((locale) => [locale, id ? `${locale}/${PAGES_DIR}/${id}/` : `${locale}/`])) as Record<Locale, string>;
  const entries = [undefined, ...mapIds].flatMap((id) => {
    const versions = paths(id);
    const links = [...LOCALES.map((l) => [l, versions[l]] as const), ['x-default', versions[DEFAULT_LOCALE]] as const]
      .map(([lang, path]) => `    <xhtml:link rel="alternate" hreflang="${lang}" href="${esc(absoluteUrl(siteUrl, path))}" />`).join('\n');
    return LOCALES.map((locale) => `  <url>\n    <loc>${esc(absoluteUrl(siteUrl, versions[locale]))}</loc>\n${links}\n  </url>`);
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join('\n')}
</urlset>
`;
}

/** Every registered map has its question and intro: src/i18n/stories.ts is typed by registry id. */
function storyOf(map: CatalogueMap, locale: Locale): MapStory {
  const story = mapStory(locale, map.id);
  if (!story) throw new Error(`No question and intro for map "${map.id}" in ${locale} (src/i18n/maps/${map.id}.ts)`);
  return story;
}

export function pageHtml(map: CatalogueMap, locale: Locale, base: string, siteUrl?: string): string {
  const { title, place, styleDef: { label: styleLabel } } = map;
  const text = messages(locale), copy = text.map;
  const topic = map.topic ? { ...topicText(locale, map.topic), ...storyOf(map, locale) } : undefined;
  const pageTitle = `${topic ? topic.question : styleLabel} — ${title}, ${place.district}`;
  const description = metaDescription(topic ? topic.intro : copy.description(title, place.district, styleLabel));
  const seo: Seo = { title: pageTitle, description, type: 'article', image: map.paths.share, imageAlt: topic?.question ?? copy.label(title, place.district) };
  return `<!doctype html>
<!-- Generated by vite.config.ts: do not edit. -->
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(pageTitle)}</title>
    <meta name="description" content="${esc(description)}" />
    ${seoTags(locale, siteUrl, seo, map)}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/src/map-page.css" />
  </head>
  <body${topic ? ' class="has-topic"' : ''} data-map="${esc(map.id)}"${topic ? ` data-question="${esc(topic.question)}" data-intro="${esc(topic.intro)}"` : ''} data-label="${esc([topic?.question, copy.label(title, place.district)].filter(Boolean).join(' '))}">
    <header class="topic-heading">
      <div class="page-navigation">
        <a class="back" href="${esc(base + pathFor(locale))}">← ${esc(copy.back)}</a>
        ${topic ? `<div class="topic-titles"><p>${esc(title)} / ${esc(place.district)}</p><h1>${esc(topic.question)}</h1></div>` : ''}
        ${languageNav(locale, base, map)}
      </div>
    </header>
    <main class="map-workspace">
    <div id="stage"></div>
    <p id="map-summary" class="sr-only">${esc(copy.summaryHelp)}</p>
    <p class="loading" role="status">${esc(copy.loading)}</p>
    <div class="map-tools">
      <div class="map-actions">
        <div class="zoom-controls" role="group" aria-label="${esc(copy.zoom)}">
          <button class="zoom-in" type="button" aria-label="${esc(copy.zoomIn)}" disabled>+</button>
          <button class="zoom-out" type="button" aria-label="${esc(copy.zoomOut)}" disabled>−</button>
        </div>
        <button class="description-button" type="button" aria-haspopup="dialog" aria-controls="map-description" disabled>${esc(copy.descriptionButton)}</button>
      </div>
    </div>
    <dialog id="map-description" aria-labelledby="description-title">
      <form method="dialog"><button autofocus>${esc(copy.close)}</button></form>
      <h2 id="description-title">${esc(copy.descriptionTitle)}</h2>
      <div id="description-content"></div>
    </dialog>
    <small class="attribution">${[
      // A place drawn from its own base layers (Place.basemap) uses no OpenStreetMap data.
      ...(map.paths.data === null ? [] : [`<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">${esc(text.attribution)}</a>`]),
      ...map.attributions.map(esc),
    ].join(' · ')}</small>
    </main>
    ${topic ? `<aside id="topic-panel" class="topic-panel" aria-label="${esc(topic.question)}"><p>${esc(topic.intro)}</p><p>${esc(topic.legend)}</p></aside>` : ''}
    <script type="module" src="/src/entries/${locale}.ts"></script>
  </body>
</html>
`;
}

const ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function strip(map: CatalogueMap, locale: Locale, base: string): string {
  const { title, place, styleDef, options } = map;
  const colors = styleDef.card(options);
  const coords = `${formatCoordinate(locale, place.lat, 'lat', 2)} ${formatCoordinate(locale, place.lon, 'lon', 2)}`;
  // Vite prefixes public asset URLs in both dev and build; page links use base directly.
  return `<li class="strip${colors.dark ? ' dark' : ''}" data-id="${esc(map.id)}" style="--bg:${esc(colors.bg)};--fg:${esc(colors.fg)};--accent:${esc(colors.accent)};--len:${title.length}">
        <a href="${esc(base + map.paths.page)}">
          <img src="/${esc(map.paths.vignette)}" alt="" loading="lazy" decoding="async" />
          <span class="shade" aria-hidden="true"></span>
          <span class="name">${esc(title)}</span>
          <span class="info"><span class="district">${esc(place.district)}</span>${map.topic ? `<span class="subject">${esc(storyOf(map, locale).question)}</span>` : ''}<span class="meta">${esc(styleDef.label)} · ${esc(coords)}</span><span class="go">${esc(messages(locale).gallery.open)}${ARROW}</span></span>
        </a>
      </li>`;
}

const SEARCH_ICON = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';

/** The search field, revealed by src/gallery/main.ts: without JavaScript every map stays shown. */
function toolsHtml(locale: Locale): string {
  const copy = messages(locale).gallery;
  return `<div class="tools" hidden>
      <search class="search">
        <label for="map-search" class="visually-hidden">${esc(copy.search)}</label>
        <span class="search-field">${SEARCH_ICON}<input id="map-search" type="search" name="q" autocomplete="off" spellcheck="false" placeholder="${esc(copy.searchHint)}" aria-keyshortcuts="/" /><kbd aria-hidden="true">/</kbd></span>
      </search>
      <p class="result-count" role="status" data-forms="${esc(JSON.stringify(copy.shown))}"></p>
    </div>`;
}

/** The search documents as JSON safe inside a script element: no `<` can end it. */
const searchIndexJson = (locale: Locale): string =>
  JSON.stringify(searchDocuments(mapsForLocale(locale), locale)).replaceAll('<', '\\u003c');

export function galleryHtml(locale: Locale, base: string, siteUrl?: string): string {
  const text = messages(locale), copy = text.gallery;
  const maps = mapsForLocale(locale);
  const pageTitle = `${copy.title} — ${boundedList(locale, [...new Set(maps.map((m) => m.title))], (list) => `${copy.title} — ${list}`.length <= TITLE_MAX)}`;
  const places = boundedList(locale, maps.map((m) => `${m.place.district} (${m.title})`), (list) => copy.description(list).length <= DESCRIPTION_MAX);
  const description = metaDescription(copy.description(places));
  const first = maps[0];
  const seo: Seo = { title: pageTitle, description, type: 'website', image: first?.paths.share ?? '', imageAlt: first ? storyOf(first, locale).question : copy.title };
  return `<!doctype html>
<!-- Generated by vite.config.ts: do not edit. -->
<html lang="${locale}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(pageTitle)}</title>
    <meta name="description" content="${esc(description)}" />
    ${seoTags(locale, siteUrl, seo)}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/src/gallery/gallery.css" />
  </head>
  <body>
    <header>
      <div class="gallery-heading"><p class="kicker">${esc(copy.title)}</p><h1>${esc(copy.heading[0])} <span>${esc(copy.heading[1])}</span></h1></div>
      <div class="gallery-context">
        ${languageNav(locale, base)}
      </div>
    </header>
    ${toolsHtml(locale)}
    <main><ul class="strips" aria-label="${esc(copy.maps)}">
      ${mapsForLocale(locale).map((map) => strip(map, locale, base)).join('\n      ')}
    </ul>
    <p class="no-match" hidden>${esc(copy.noMatch)} <button type="button" class="reset">${esc(copy.reset)}</button></p></main>
    <script type="application/json" id="search-index">${searchIndexJson(locale)}</script>
    <footer>${esc(text.data)} <a href="https://www.openstreetmap.org/copyright">${esc(text.attribution)}</a> (ODbL)</footer>
    <script type="module" src="/src/gallery/main.ts"></script>
  </body>
</html>
`;
}
