// Subject "setbacks": which towers of the square rise in steps, by building period.
// A tower is a building at least TOWER_M tall; its form is read from its OSM building
// parts. Local metres; runs in the browser and in Node: no DOM, no Node API.
import { featuresOf, hasParts, heightOf, yearOf, type Feature, type Layer, type Ring } from '../../layers.ts';
import { owners, ringArea, ringCentroid } from '../../rings.ts';
import type { Point } from '../../toolkit/geometry.ts';

/** Height from which a building counts as a tower, m. */
export const TOWER_M = 80;
/** Parts whose tops lie within this many metres share a level. */
export const LEVEL_STEP_M = 6;
/** A stepped tower has at least this many levels… */
export const MIN_LEVELS = 3;
/** …and its top level covers less than this share of its footprint. */
export const TOP_SHARE = 0.6;
/** Parts within this share of the tower's height belong to its top level. */
const TOP_BAND = 0.9;

/** Building periods, after the New York zoning resolutions of 1916 and 1961. */
export const PERIOD_IDS = ['before-1916', 'zoning-1916', 'zoning-1961', 'undated'] as const;
export type PeriodId = (typeof PERIOD_IDS)[number];

/** stepped: rises in steps; block: one volume; unknown: OSM gives no parts to tell. */
export type TowerForm = 'stepped' | 'block' | 'unknown';

export interface Tower {
  /** The building outline, from the buildings layer. */
  feature: Feature<Ring[]>;
  /** Its parts, from the building-parts layer. */
  parts: Feature<Ring[]>[];
  name?: string;
  point: Point;
  /** Highest top of the outline and its parts, m. */
  top: number;
  year?: number;
  period: PeriodId;
  form: TowerForm;
  /** Distinct heights among the parts. */
  levels: number;
}

export interface PeriodCount {
  id: PeriodId;
  /** Towers built in the period. */
  towers: number;
  /** Of which OSM details the parts. */
  detailed: number;
  /** Of which rise in steps. */
  stepped: number;
}

export interface SetbackEvidence {
  towers: Tower[];
  periods: PeriodCount[];
}

export const periodOf = (year: number | undefined): PeriodId =>
  year === undefined ? 'undated' : year < 1916 ? 'before-1916' : year <= 1960 ? 'zoning-1916' : 'zoning-1961';

/** The form of a tower from its parts' heights and footprints. */
export function formOf(outline: Feature<Ring[]>, parts: readonly Feature<Ring[]>[], top: number): { form: TowerForm; levels: number } {
  const measured = parts.filter((p) => heightOf(p) !== undefined);
  if (!hasParts(outline) || !measured.length) return { form: 'unknown', levels: 0 };
  const levels = new Set(measured.map((p) => Math.round(heightOf(p)! / LEVEL_STEP_M))).size;
  const footprint = ringArea(outline.g[0]!);
  const topArea = measured.filter((p) => heightOf(p)! >= top * TOP_BAND).reduce((s, p) => s + ringArea(p.g[0]!), 0);
  return { form: levels >= MIN_LEVELS && topArea < TOP_SHARE * footprint ? 'stepped' : 'block', levels };
}

/** The towers whose outline centre lies in the square, and their counts per period. */
export function analyseSetbacks(layers: readonly Layer[], half: number): SetbackEvidence {
  const buildings = featuresOf(layers, 'buildings', 'areas');
  const parts = featuresOf(layers, 'building-parts', 'areas');
  const byOwner = new Map<number, Feature<Ring[]>[]>();
  owners(buildings, parts).forEach((owner, i) => {
    if (owner < 0) return;
    const list = byOwner.get(owner) ?? [];
    list.push(parts[i]!);
    byOwner.set(owner, list);
  });
  const towers: Tower[] = [];
  buildings.forEach((feature, i) => {
    const own = byOwner.get(i) ?? [];
    const top = Math.max(heightOf(feature) ?? 0, ...own.map((p) => (heightOf(p) ?? 0)));
    const point = ringCentroid(feature.g[0]!);
    if (top < TOWER_M || Math.abs(point[0]) > half || Math.abs(point[1]) > half) return;
    const year = yearOf(feature);
    towers.push({
      feature, parts: own, point, top, period: periodOf(year), ...formOf(feature, own, top),
      ...(feature.n && { name: feature.n }), ...(year !== undefined && { year }),
    });
  });
  towers.sort((a, b) => b.top - a.top);
  const periods = PERIOD_IDS.map((id): PeriodCount => {
    const of = towers.filter((t) => t.period === id);
    return { id, towers: of.length, detailed: of.filter((t) => t.form !== 'unknown').length, stepped: of.filter((t) => t.form === 'stepped').length };
  });
  return { towers, periods };
}
