import { MAPS } from '../registry.js';
import { STYLES } from '../styles/index.js';

const places = Object.fromEntries(
  Object.entries(import.meta.glob('../../places/*.js', { eager: true, import: 'default' }))
    .map(([path, place]) => [path.match(/([^/]+)\.js$/)[1], place]),
);

const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;

const list = document.querySelector('.maps');
for (const m of MAPS) {
  const place = places[m.place];
  const style = STYLES[m.style];
  const colors = style.card(m.options);
  const li = document.createElement('li');
  const a = document.createElement('a');
  a.className = 'card';
  a.href = `cartes/${m.id}/`;
  a.style.setProperty('--bg', colors.bg);
  a.style.setProperty('--fg', colors.fg);
  a.style.setProperty('--accent', colors.accent);

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
  list.append(li);
}
