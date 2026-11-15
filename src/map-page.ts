// Entry of every generated map page: <body data-map="<id>">. Loads the map's data and
// style, then hands the stage over to the style's mount().
import { parseMapData } from './data.ts';
import { bodyData, element } from './dom.ts';
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
  shell.ready();
  return handle;
}

const id = bodyData('map');
const entry = MAPS.find((m) => m.id === id);
if (!entry) throw new Error(`Unknown map "${id}" (src/registry.ts)`);
const handle = await open(entry);
if (import.meta.env.DEV) window.__map = handle;
