// Entry of every generated map page: <body data-map="<id>">. Loads the map's data and
// style, then hands the stage over to the style's mount().
import { bodyData, element } from './dom.ts';
import { describeMap } from './map-description.ts';
import { findMap, type CatalogueMapOf } from './catalogue.ts';
import { parseLayerFile, type Layer } from './layers.ts';
import { mountMetaOf } from './map-meta.ts';
import { createShell } from './shell.ts';
import type { MapHandle } from './styles/contract.ts';
import type { StyleKey } from './styles/index.ts';
import { ZOOM_STEP } from './toolkit/viewport.ts';
import { DEFAULT_LOCALE, isLocale, mapStory, messages } from './i18n/index.ts';
import { analyseTopic } from './topics.ts';
import { mountTopicPanel } from './topic-panel.ts';
import { enhanceLanguageMenu } from './languages.ts';

enhanceLanguageMenu();

const lang = document.documentElement.lang;
const locale = isLocale(lang) ? lang : DEFAULT_LOCALE;
const copy = messages(locale).map;

declare global {
  interface Window {
    /** Development only: the mounted map, for debugging in the console. */
    __map?: MapHandle;
  }
}

async function open<K extends StyleKey>(map: CatalogueMapOf<K>): Promise<MapHandle> {
  const { styleDef: style, options } = map;

  const shell = createShell({
    label: bodyData('label'),
    colors: style.card(options),
  });

  const url = `${import.meta.env.BASE_URL}${map.paths.data}`;
  const [styleModule, osm, layerSets] = await Promise.all([
    style.load(),
    fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`Missing data for ${map.placeId}: HTTP ${r.status}`);
      return parseLayerFile(await r.json(), url);
    }),
    Promise.all(map.layers.map(async ({ id, path }) => {
      const layerUrl = `${import.meta.env.BASE_URL}${path}`;
      const r = await fetch(layerUrl);
      if (!r.ok) throw new Error(`Missing layer ${id} for ${map.placeId}: HTTP ${r.status}`);
      return { id, layers: parseLayerFile(await r.json(), layerUrl).layers };
    })),
  ]);
  const layers: Layer[] = [...osm.layers, ...layerSets.flatMap((set) => set.layers)];
  const overlays = layerSets.flatMap((set, i) => set.layers.map((layer) => ({ title: map.layers[i]?.title ?? set.id, layer })));

  const { survey, meta } = mountMetaOf(map, osm);
  const story = mapStory(locale, map.id);
  if (!story) throw new Error(`No question and intro for map "${map.id}" (maps in src/i18n)`);
  const topic = map.topic ? analyseTopic(survey, layers, map.topic) : undefined;
  describeMap(element('#description-content', HTMLElement), element('#map-summary', HTMLElement), survey, layers, meta, style.legend, locale, topic && { analysis: topic, story }, overlays);
  const dialog = element('#map-description', HTMLDialogElement);
  const description = element('.description-button', HTMLButtonElement);
  description.disabled = false;
  description.addEventListener('click', () => dialog.showModal());

  if (import.meta.env.DEV) {
    console.log(`${map.place.name} — ${map.place.district} : éléments par couche`);
    console.table(Object.fromEntries(osm.layers.map((l) => [l.id, l.features.length])));
  }

  const handle = await styleModule.mount({
    container: element('#stage', HTMLElement),
    meta,
    locale,
    options,
    shell,
    layers,
    ...(topic ? { topic } : {}),
  });
  if (topic) mountTopicPanel(element('#topic-panel', HTMLElement), survey, topic, story, locale, handle, url);
  if (handle.viewport) {
    const viewport = handle.viewport;
    for (const [selector, factor] of [['.zoom-in', ZOOM_STEP], ['.zoom-out', 1 / ZOOM_STEP]] as const) {
      const button = element(selector, HTMLButtonElement);
      button.disabled = false;
      button.addEventListener('click', () => viewport.zoom(factor));
    }
  } else {
    document.querySelector('.zoom-controls')?.remove();
  }
  shell.ready();
  return handle;
}

const id = bodyData('map');
const map = findMap(id, locale);
try {
  if (!map) throw new Error(`Unknown map "${id}" (src/registry.ts)`);
  const handle = await open(map);
  if (import.meta.env.DEV) window.__map = handle;
  if (window.location.hash === '#vignette') {
    const { captureVignette } = await import('./vignette.ts');
    captureVignette(element('#stage', HTMLElement));
  }
} catch (err) {
  console.error('Map loading failed:', err);
  element('#stage', HTMLElement).replaceChildren();
  const status = element('.loading', HTMLElement);
  status.setAttribute('role', 'alert');
  status.textContent = copy.error;
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = copy.retry;
  retry.addEventListener('click', () => window.location.reload());
  status.append(document.createElement('br'), retry);
}
