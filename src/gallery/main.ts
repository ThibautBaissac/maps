import { element } from '../dom.ts';
import type { Place } from '../place.ts';
import { MAPS, type MapEntryOf } from '../registry.ts';
import { STYLES, type StyleKey } from '../styles/index.ts';

const places = new Map(
  Object.entries(import.meta.glob<Place>('../../places/*.ts', { eager: true, import: 'default' }))
    .map(([path, place]) => [path.replace(/^.*\/|\.ts$/g, ''), place]),
);

const fmt = (v: number, pos: string, neg: string): string => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;

function card<K extends StyleKey>(m: MapEntryOf<K>): HTMLLIElement {
  const place = places.get(m.place);
  if (!place) throw new Error(`No file places/${m.place}.ts (${m.id})`);
  const style = STYLES[m.style];
  const colors = style.card(m.options);
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'card';
  a.href = `cartes/${m.id}/`;
  a.style.setProperty('--bg', colors.bg);
  a.style.setProperty('--fg', colors.fg);
  a.style.setProperty('--accent', colors.accent);
  if (colors.dark) a.classList.add('dark'); // light ink on a dark ground

  const art = document.createElement('span');
  art.className = 'art';
  art.setAttribute('aria-hidden', 'true');
  const name = m.title ?? place.name;
  art.innerHTML = '<span class="shadow"></span><span class="ink"></span>';
  art.querySelectorAll('span').forEach((s) => { s.textContent = name; });

  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = `${name} — ${place.district}`;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = `${style.label} · ${fmt(place.lat, 'N', 'S')}, ${fmt(place.lon, 'E', 'O')}`;

  a.append(art, title, meta);
  li.append(a);
  return li;
}

const list = element('.maps', HTMLUListElement);
for (const m of MAPS) list.append(card(m));
