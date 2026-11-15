// Entry of every generated map page: <body data-map="<id>">.
import { MAPS } from './registry.js';
import { STYLES } from './styles/index.js';
import { createMapApp } from './engine/app.js';

const id = document.body.dataset.map;
const entry = MAPS.find((m) => m.id === id);
if (!entry) throw new Error(`Unknown map "${id}" (src/registry.js)`);

// HTML overlays (back link, attribution, loading text) follow the map's colours.
const colors = STYLES[entry.style].card(entry.options);
document.documentElement.style.setProperty('--bg', colors.bg);
document.documentElement.style.setProperty('--accent', colors.accent);

const [styleModule, data] = await Promise.all([
  STYLES[entry.style].load(),
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

const app = await createMapApp({
  canvas: document.getElementById('map'),
  attribution: document.querySelector('.attribution'),
  nav: document.querySelector('.back'),
  data,
  style: styleModule.create(entry.options),
});
document.querySelector('.loading')?.remove();
if (import.meta.env.DEV) window.__map = app;
