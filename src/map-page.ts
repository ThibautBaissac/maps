// Entry of every generated map page: <body data-map="<id>">. Loads the map's data and
// style, then hands the stage over to the style's mount().
import { parseMapData } from './data.ts';
import { bodyData, element } from './dom.ts';
import { describeMap } from './map-description.ts';
import { MAPS, type MapEntryOf } from './registry.ts';
import { createShell } from './shell.ts';
import type { MapHandle } from './styles/contract.ts';
import { STYLES, type StyleKey, type StyleOptions } from './styles/index.ts';

declare global {
  interface Window {
    /** Development only: the mounted map, for debugging in the console. */
    __map?: MapHandle;
  }
}

async function open<K extends StyleKey>(entry: MapEntryOf<K>): Promise<MapHandle> {
  const style = STYLES[entry.style];
  const options: Partial<StyleOptions[K]> = entry.options ?? {};

  const shell = createShell({
    label: bodyData('label'),
    colors: style.card(options),
  });

  const url = `${import.meta.env.BASE_URL}data/${entry.place}.json`;
  const [styleModule, data] = await Promise.all([
    style.load(),
    fetch(url).then(async (r) => {
      if (!r.ok) throw new Error(`Missing data for ${entry.place}: HTTP ${r.status}`);
      return parseMapData(await r.json(), url);
    }),
  ]);

  describeMap(element('#description-content', HTMLElement), element('#map-summary', HTMLElement), data, entry.title ?? data.meta.name, style.legend);
  const dialog = element('#map-description', HTMLDialogElement);
  const description = element('.description-button', HTMLButtonElement);
  description.disabled = false;
  description.addEventListener('click', () => dialog.showModal());

  if (import.meta.env.DEV) {
    console.log(`${data.meta.name} — ${data.meta.district} : éléments par type`);
    console.table({
      bâtiments: data.buildings.length,
      routes: data.roads.length,
      'cours d’eau': data.waterways.length,
      'plans d’eau': data.water.length,
      parcs: data.parks.length,
    });
  }

  const handle = await styleModule.mount({
    container: element('#stage', HTMLElement),
    data,
    meta: { ...data.meta, title: entry.title ?? data.meta.name },
    options,
    shell,
  });
  if (handle.viewport) {
    const viewport = handle.viewport;
    for (const [selector, factor] of [['.zoom-in', 1.5], ['.zoom-out', 1 / 1.5]] as const) {
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
const entry = MAPS.find((m) => m.id === id);
try {
  if (!entry) throw new Error(`Unknown map "${id}" (src/registry.ts)`);
  const handle = await open(entry);
  if (import.meta.env.DEV) window.__map = handle;
  if (window.location.hash === '#vignette') {
    const { captureVignette } = await import('./vignette.ts');
    captureVignette(handle, element('#stage', HTMLElement));
  }
} catch (err) {
  console.error('Map loading failed:', err);
  element('#stage', HTMLElement).replaceChildren();
  const status = element('.loading', HTMLElement);
  status.setAttribute('role', 'alert');
  status.textContent = 'Impossible de charger le plan. Vérifiez votre connexion, puis réessayez.';
  const retry = document.createElement('button');
  retry.type = 'button';
  retry.textContent = 'Réessayer';
  retry.addEventListener('click', () => window.location.reload());
  status.append(document.createElement('br'), retry);
}
