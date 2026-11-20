// The detail card of the dossier style: what a click on a mark or a hatched area tells.
// The hit tests are pure; the card itself is a small HTML element over the stage.
import type { Departement, Investigation } from '../../topics/investigations/evidence.ts';
import { REGIONS } from '../../topics/investigations/evidence.ts';
import type { Ring } from '../../layers.ts';
import type { Point } from '../../toolkit/geometry.ts';
import type { Locale } from '../../i18n/index.ts';
import { MESSAGES as INVESTIGATIONS } from '../../topics/investigations/messages.ts';

/** A mark as drawn: its investigation and its screen position, device px. */
export interface PlacedMark { item: Investigation; x: number; y: number }

/** The mark under (x, y), device px, within `radius`; the closest when marks touch. */
export function markAt(marks: readonly PlacedMark[], x: number, y: number, radius: number): PlacedMark | undefined {
  let best: PlacedMark | undefined, distance = radius;
  for (const m of marks) {
    const d = Math.hypot(m.x - x, m.y - y);
    if (d <= distance) { best = m; distance = d; }
  }
  return best;
}

function inRing(r: Ring, [x, y]: Point): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i]!, yi = r[i + 1]!, xj = r[j]!, yj = r[j + 1]!;
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The département whose outline holds `point` (local metres). */
export function departementAt(departements: readonly Departement[], point: Point): Departement | undefined {
  // Rings of a département are its pieces and holes alike: an odd count of rings holding the point means inside.
  return departements.find((d) => d.rings.filter((r) => inRing(r, point)).length % 2 === 1);
}

/** Investigations hatched over a département: those located to it, then those located to its region only. */
export function areaInvestigations(investigations: readonly Investigation[], d: Departement): Investigation[] {
  return [
    ...investigations.filter((i) => i.precision === 'departement' && i.departement === d.code),
    ...investigations.filter((i) => i.precision === 'region' && i.region === d.region),
  ];
}

/** Where an investigation took place, as precisely as its page says. */
export function placeText(i: Investigation, departementName: (code: string) => string, locale: Locale): string {
  const c = INVESTIGATIONS[locale].card;
  const region = REGIONS[i.region] ?? i.region;
  if (i.precision === 'commune' && i.commune) return c.commune(i.commune, i.departement ? departementName(i.departement) : region);
  if (i.precision !== 'region' && i.departement) return c.departement(departementName(i.departement));
  return c.region(region);
}

export interface Card {
  /** Shows the card at (x, y), CSS px in the stage, for one or several investigations. */
  show(x: number, y: number, investigations: readonly Investigation[], heading?: string): void;
  hide(): void;
  readonly open: boolean;
  destroy(): void;
}

export function createCard(container: HTMLElement, locale: Locale, departementName: (code: string) => string): Card {
  const text = INVESTIGATIONS[locale];
  const el = document.createElement('div');
  el.className = 'map-card';
  el.setAttribute('role', 'dialog');
  el.hidden = true;
  container.append(el);
  const abort = new AbortController();
  const hide = (): void => { el.hidden = true; el.replaceChildren(); };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !el.hidden) hide(); }, { signal: abort.signal });

  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, content?: string, className?: string): HTMLElementTagNameMap[K] => {
    const n = document.createElement(tag);
    if (content) n.textContent = content;
    if (className) n.className = className;
    return n;
  };
  const entry = (i: Investigation): HTMLElement => {
    const block = node('article');
    block.append(
      node('p', `${text.sites[i.site]} · ${i.year}`, 'map-card-kicker'),
      node('h2', i.name),
      node('p', placeText(i, departementName, locale)),
    );
    if (i.species.length) block.append(node('p', i.species.map((s) => text.species[s]).join(', '), 'map-card-species'));
    if (i.url) {
      const link = node('a', text.card.open);
      link.href = i.url; link.target = '_blank'; link.rel = 'noopener';
      block.append(link);
    }
    return block;
  };

  return {
    get open() { return !el.hidden; },
    show(x, y, investigations, heading) {
      const close = node('button', '×', 'map-card-close');
      close.type = 'button';
      close.setAttribute('aria-label', text.card.close);
      close.addEventListener('click', hide);
      el.replaceChildren(close, ...(heading ? [node('p', heading, 'map-card-heading')] : []), ...investigations.map(entry));
      el.setAttribute('aria-label', heading ?? investigations[0]?.name ?? '');
      el.hidden = false;
      // Beside the click, kept inside the stage.
      const w = el.offsetWidth, h = el.offsetHeight, W = container.clientWidth, H = container.clientHeight;
      el.style.left = `${Math.max(8, Math.min(x + 14, W - w - 8))}px`;
      el.style.top = `${Math.max(8, Math.min(y - 20, H - h - 8))}px`;
      close.focus({ preventScroll: true });
    },
    hide,
    destroy() { abort.abort(); el.remove(); },
  };
}
