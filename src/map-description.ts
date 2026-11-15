import type { Line, MapData } from './data.ts';

type Feature = readonly [name: string | undefined, paths: readonly Line[]];
interface Bounds { left: number; right: number; bottom: number; top: number }

const positions = [
  ['au sud-ouest', 'au sud', 'au sud-est'],
  ['à l’ouest', 'au centre', 'à l’est'],
  ['au nord-ouest', 'au nord', 'au nord-est'],
] as const;

function namedFeatures(features: readonly Feature[], half: number): HTMLUListElement {
  const names = new Map<string, Bounds>();
  for (const [name, paths] of features) {
    if (!name) continue;
    for (const p of paths) for (let i = 0; i < p.length; i += 2) {
      const x = p[i]!, y = p[i + 1]!; // complete coordinate pairs from fetch-osm
      if (Math.abs(x) > half || Math.abs(y) > half) continue;
      const b = names.get(name) ?? { left: x, right: x, bottom: y, top: y };
      b.left = Math.min(b.left, x); b.right = Math.max(b.right, x);
      b.bottom = Math.min(b.bottom, y); b.top = Math.max(b.top, y);
      names.set(name, b);
    }
  }
  const band = (v: number): 0 | 1 | 2 => v < -half / 3 ? 0 : v > half / 3 ? 2 : 1;
  const list = document.createElement('ul');
  for (const [name, b] of [...names].sort(([a], [b]) => a.localeCompare(b, 'fr'))) {
    const item = document.createElement('li');
    item.textContent = `${name} — ${positions[band((b.bottom + b.top) / 2)][band((b.left + b.right) / 2)]}.`;
    list.append(item);
  }
  return list;
}

/** Whole-survey description, independent of the visual zoom and the drawing technique. */
export function describeMap(container: HTMLElement, summary: HTMLElement, data: MapData, title: string, legend: readonly string[]): void {
  const { meta } = data;
  const fmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 4 });
  const overview = `${title}, ${meta.district}. Zone carrée de ${fmt.format(meta.sizeKm)} km de côté. Le nord se trouve en haut.`;
  summary.textContent = `${overview} Consultez le bouton Description pour la légende et les voies nommées.`;
  container.replaceChildren();
  const paragraph = (text: string): void => {
    const p = document.createElement('p');
    p.textContent = text;
    container.append(p);
  };
  paragraph(overview);
  paragraph(`Centre : latitude ${fmt.format(meta.lat)}°, longitude ${fmt.format(meta.lon)}°. Relevé OpenStreetMap du ${meta.fetchedAt.slice(0, 10)}.`);
  paragraph(`Contenu du relevé : ${fmt.format(data.buildings.length)} bâtiments, ${fmt.format(data.roads.length)} tronçons de voies, ${fmt.format(data.parks.length)} espaces verts et ${fmt.format(data.water.length)} surfaces d’eau.`);
  const heading = document.createElement('h2');
  heading.textContent = 'Légende';
  const key = document.createElement('ul');
  for (const text of legend) {
    const item = document.createElement('li');
    item.textContent = text;
    key.append(item);
  }
  container.append(heading, key);
  paragraph('Les positions indiquent un secteur approximatif par rapport au centre du plan. Elles décrivent la zone entière, quel que soit le zoom.');
  const sections: [string, Feature[]][] = [
    ['Rues et voies nommées', data.roads.map((r) => [r.n, [r.p]])],
    ['Eaux nommées', [
      ...data.waterways.filter((w) => !w.u).map((w): Feature => [w.n, [w.p]]),
      ...data.water.map((w): Feature => [w.n, w.r]),
    ]],
  ];
  for (const [title, features] of sections) {
    const list = namedFeatures(features, meta.half);
    const details = document.createElement('details');
    const caption = document.createElement('summary');
    caption.textContent = `${title} (${list.childElementCount})`;
    details.append(caption);
    if (list.childElementCount) details.append(list);
    else {
      const empty = document.createElement('p');
      empty.textContent = 'Aucun nom dans le relevé pour cette zone.';
      details.append(empty);
    }
    container.append(details);
  }
}
