// Entry of every generated map page: <body data-map="<id>">. Loads the map's data and
// style, then hands the stage over to the style's mount().
import { MAPS } from './registry.js';
import { STYLES } from './styles/index.js';
import { createShell } from './shell.js';

const id = document.body.dataset.map;
const entry = MAPS.find((m) => m.id === id);
if (!entry) throw new Error(`Unknown map "${id}" (src/registry.js)`);
const style = STYLES[entry.style];
const options = entry.options ?? {};

const shell = createShell({
  label: document.body.dataset.label,
  colors: style.card(options),
});

const [styleModule, data] = await Promise.all([
  style.load(),
  fetch(`${import.meta.env.BASE_URL}data/${entry.place}.json`).then((r) => {
    if (!r.ok) throw new Error(`Missing data for ${entry.place}: HTTP ${r.status}`);
    return r.json();
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
  container: document.getElementById('stage'),
  data,
  meta: { ...data.meta, title: entry.title ?? data.meta.name },
  options,
  shell,
});
shell.ready();
if (import.meta.env.DEV) window.__map = handle;
