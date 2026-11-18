// The L214 investigations subject (topic investigations): where the published investigations
// took place, from the overlay points of the france place and its base départements.
// Pure: runs in the browser and in Node.
import { featuresOf, type Feature, type Layer, type Ring } from './layers.ts';
import type { Point } from './toolkit/geometry.ts';

/** What was filmed: the kind of site. */
export const SITE_KINDS = ['abattoir', 'elevage', 'couvoir', 'transport', 'autre'] as const;
export type SiteKind = (typeof SITE_KINDS)[number];
const isSiteKind = (v: unknown): v is SiteKind => (SITE_KINDS as readonly unknown[]).includes(v);

/** Animals an investigation shows, as the register names them. */
export const SPECIES = [
  'bovins', 'veaux', 'cochons', 'poulets', 'poules', 'dindes', 'canards', 'cailles', 'pintades', 'lapins',
  'moutons', 'chevres', 'chevaux', 'poissons', 'visons', 'cerfs', 'faisans', 'poussins', 'autres',
] as const;
export type Species = (typeof SPECIES)[number];
const isSpecies = (v: string): v is Species => (SPECIES as readonly string[]).includes(v);

/** How precisely an investigation is located: its town, or only its département or region. */
export const PRECISIONS = ['commune', 'departement', 'region'] as const;
export type Precision = (typeof PRECISIONS)[number];
const isPrecision = (v: unknown): v is Precision => (PRECISIONS as readonly unknown[]).includes(v);

/** The 13 regions of metropolitan France by INSEE code, with their official names. */
export const REGIONS: Readonly<Record<string, string>> = {
  '11': 'Île-de-France',
  '24': 'Centre-Val de Loire',
  '27': 'Bourgogne-Franche-Comté',
  '28': 'Normandie',
  '32': 'Hauts-de-France',
  '44': 'Grand Est',
  '52': 'Pays de la Loire',
  '53': 'Bretagne',
  '75': 'Nouvelle-Aquitaine',
  '76': 'Occitanie',
  '84': 'Auvergne-Rhône-Alpes',
  '93': 'Provence-Alpes-Côte d’Azur',
  '94': 'Corse',
};

export interface Investigation {
  /** Title as published by L214, in French. */
  name: string;
  /** The town, or the centre of the département or region when only that is known. */
  point: Point;
  year: number;
  site: SiteKind;
  precision: Precision;
  /** Town name, when precision is commune. */
  commune?: string;
  departement?: string;
  region: string;
  /** Animals shown, in the register's order. */
  species: Species[];
  url?: string;
}

/** An investigation published without a place in metropolitan France: cited beside the map. */
export interface UnlocatedInvestigation {
  name: string;
  year: number;
  site: SiteKind;
  url: string;
}

export interface Departement {
  code: string;
  name: string;
  region: string;
  rings: Ring[];
  /** Centre of its largest ring's bounding box. */
  centre: Point;
}

export interface RegionCount {
  code: string;
  name: string;
  count: number;
}

export interface InvestigationEvidence {
  /** Investigations placed on the map, oldest first. */
  investigations: Investigation[];
  unlocated: readonly UnlocatedInvestigation[];
  departements: Departement[];
  /** Codes of the départements and regions hatched for investigations located no closer. */
  hatched: { departements: string[]; regions: string[] };
  /** Investigations placed on the map, by region, most first. */
  regions: RegionCount[];
  /** Investigations placed on the map, by département code. */
  byDepartement: Map<string, number>;
  sites: Record<SiteKind, number>;
  years: [first: number, last: number] | null;
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);

function investigationOf(f: Feature<Point>): Investigation | null {
  const p = f.p ?? {};
  const year = p['year'], precision = p['precision'], region = text(p['region']);
  if (!f.n || !isSiteKind(f.k) || typeof year !== 'number' || !isPrecision(precision) || !region) return null;
  const commune = text(p['commune']), departement = text(p['departement']), url = text(p['url']);
  const species = (text(p['species']) ?? '').split(',').filter(isSpecies);
  return {
    name: f.n, point: f.g, year, site: f.k, precision, region, species,
    ...(commune ? { commune } : {}), ...(departement ? { departement } : {}), ...(url ? { url } : {}),
  };
}

function centreOf(rings: readonly Ring[]): Point {
  let best: Ring | undefined, area = -1;
  for (const r of rings) {
    let a = 0;
    for (let i = 0; i + 3 < r.length; i += 2) a += r[i]! * r[i + 3]! - r[i + 2]! * r[i + 1]!;
    if (Math.abs(a) > area) { area = Math.abs(a); best = r; }
  }
  if (!best) return [0, 0];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < best.length; i += 2) {
    x0 = Math.min(x0, best[i]!); x1 = Math.max(x1, best[i]!);
    y0 = Math.min(y0, best[i + 1]!); y1 = Math.max(y1, best[i + 1]!);
  }
  return [(x0 + x1) / 2, (y0 + y1) / 2];
}

/** Départements: base areas whose category is their code; a département may come in several pieces. */
export function departementsOf(layers: readonly Layer[]): Departement[] {
  const byCode = new Map<string, Departement>();
  for (const f of featuresOf(layers, 'base', 'areas')) {
    const region = text(f.p?.['region']);
    if (!f.k || !region) continue;
    const d = byCode.get(f.k) ?? { code: f.k, name: f.n ?? f.k, region, rings: [], centre: [0, 0] };
    d.rings.push(...f.g);
    byCode.set(f.k, d);
  }
  return [...byCode.values()].map((d) => ({ ...d, centre: centreOf(d.rings) }));
}

export function analyseInvestigations(layers: readonly Layer[], unlocated: readonly UnlocatedInvestigation[]): InvestigationEvidence {
  const investigations = featuresOf(layers, 'overlay', 'points').flatMap((f) => investigationOf(f) ?? [])
    .sort((a, b) => a.year - b.year || a.name.localeCompare(b.name, 'fr'));
  const departements = departementsOf(layers);
  const sites = Object.fromEntries(SITE_KINDS.map((k) => [k, 0])) as Record<SiteKind, number>;
  const byRegion = new Map<string, number>(), byDepartement = new Map<string, number>();
  const hatchedDepartements = new Set<string>(), hatchedRegions = new Set<string>();
  for (const i of investigations) {
    sites[i.site]++;
    byRegion.set(i.region, (byRegion.get(i.region) ?? 0) + 1);
    if (i.departement) byDepartement.set(i.departement, (byDepartement.get(i.departement) ?? 0) + 1);
    if (i.precision === 'departement' && i.departement) hatchedDepartements.add(i.departement);
    if (i.precision === 'region') hatchedRegions.add(i.region);
  }
  const regions = [...byRegion].map(([code, count]) => ({ code, name: REGIONS[code] ?? code, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
  const years = investigations.length ? [investigations[0]!.year, investigations.at(-1)!.year] as [number, number] : null;
  return {
    investigations, unlocated, departements,
    hatched: { departements: [...hatchedDepartements].sort(), regions: [...hatchedRegions].sort() },
    regions, byDepartement, sites, years,
  };
}
