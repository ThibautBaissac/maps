import { element } from '../dom.ts';
import type { Place } from '../place.ts';
import { MAPS, type MapEntryOf } from '../registry.ts';
import { STYLES, type StyleKey } from '../styles/index.ts';

const places = new Map(
  Object.entries(import.meta.glob<Place>('../../places/*.ts', { eager: true, import: 'default' }))
    .map(([path, place]) => [path.replace(/^.*\/|\.ts$/g, ''), place]),
);

const fmt = (v: number, pos: string, neg: string): string => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;

function span(className: string, text: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.className = className;
  s.textContent = text;
  return s;
}

const ARROW = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

// One vertical strip: the map's picture (public/vignettes/<id>.webp, made by
// npm run vignettes), its name read upwards, and what it is.
function strip<K extends StyleKey>(m: MapEntryOf<K>): HTMLLIElement {
  const place = places.get(m.place);
  if (!place) throw new Error(`No file places/${m.place}.ts (${m.id})`);
  const style = STYLES[m.style];
  const colors = style.card(m.options);
  const name = m.title ?? place.name;

  const li = document.createElement('li');
  li.className = 'strip';
  li.style.setProperty('--bg', colors.bg);
  li.style.setProperty('--fg', colors.fg);
  li.style.setProperty('--accent', colors.accent);
  li.style.setProperty('--len', String(name.length));
  if (colors.dark) li.classList.add('dark'); // light ink on a dark ground: no offset shadow

  const a = document.createElement('a');
  a.href = `cartes/${m.id}/`;

  // Without its picture, the strip keeps the style's paper and a dot screen.
  const img = document.createElement('img');
  img.src = `${import.meta.env.BASE_URL}vignettes/${m.id}.webp`;
  img.alt = '';
  img.decoding = 'async';
  img.addEventListener('error', () => img.remove());

  const shade = span('shade', '');
  shade.setAttribute('aria-hidden', 'true');

  const info = span('info', '');
  const go = span('go', 'Ouvrir la carte');
  go.insertAdjacentHTML('beforeend', ARROW);
  info.append(
    span('district', place.district),
    span('meta', `${style.label} · ${fmt(place.lat, 'N', 'S')} ${fmt(place.lon, 'E', 'O')}`),
    go,
  );

  a.append(img, shade, span('name', name), info);
  li.append(a);
  return li;
}

const list = element('.strips', HTMLUListElement);
for (const m of MAPS) list.append(strip(m));
