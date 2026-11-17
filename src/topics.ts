// Geographic evidence shared by the drawing and its text. Coordinates and lengths are
// local metres; nothing here depends on the browser or on a language.
import { featuresOf, isBridge, isTunnel, type Feature, type Layer, type Line, type Survey } from './layers.ts';
import type { Point, Rect } from './toolkit/geometry.ts';
import { analyseCholera, type CholeraEvidence } from './cholera.ts';

export const TOPIC_IDS = ['canal-crossings', 'steps', 'cholera-pump'] as const;
export type TopicId = (typeof TOPIC_IDS)[number];
/** Subjects measured as lengths of selected street geometry. */
export type LinearTopicId = Exclude<TopicId, 'cholera-pump'>;
export const isTopicId = (value: string): value is TopicId => (TOPIC_IDS as readonly string[]).includes(value);

/** Themes the gallery filters by; their labels are under themes.<id> in the dictionaries. */
export const THEME_IDS = ['water', 'relief', 'history', 'health'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
/** The themes of each subject, most specific first: every map of the subject shares them. */
export const TOPIC_THEMES: Record<TopicId, readonly ThemeId[]> = {
  'canal-crossings': ['water'],
  steps: ['relief'],
  'cholera-pump': ['history', 'health', 'water'],
};

/** A numbered reference on the map and in the panel. */
export interface TopicMark {
  name: string;
  point: Point;
}

export interface TopicPlace extends TopicMark {
  length: number;
  /** Index into the south-to-north, west-to-east nine-sector grid. */
  sector: number;
  waters: string[];
}

export interface LinearTopic {
  id: LinearTopicId;
  segments: Feature<Line>[];
  length: number;
  sectors: { length: number }[];
  places: TopicPlace[];
  canals: string[];
}

export interface CholeraTopic extends CholeraEvidence {
  id: 'cholera-pump';
  /** The Broad Street pump, then Snow's landmarks. */
  places: (TopicMark & { kind: 'pump' | 'workhouse' | 'brewery' })[];
}

export type TopicAnalysis = LinearTopic | CholeraTopic;

const EPS = 1e-8;
const lengthOf = (p: Line): number => {
  let length = 0;
  for (let i = 2; i < p.length; i += 2) length += Math.hypot(p[i]! - p[i - 2]!, p[i + 1]! - p[i - 1]!);
  return length;
};

function clipLine(p: Line, [left, bottom, right, top]: Rect): Line[] {
  const lines: Line[] = [];
  let chain: Line = [];
  for (let i = 2; i < p.length; i += 2) {
    const x = p[i - 2]!, y = p[i - 1]!, dx = p[i]! - x, dy = p[i + 1]! - y;
    let start = 0, end = 1, visible = true;
    for (const [v, distance] of [[-dx, x - left], [dx, right - x], [-dy, y - bottom], [dy, top - y]] as const) {
      if (Math.abs(v) < EPS) { if (distance < 0) visible = false; continue; }
      const t = distance / v;
      if (v < 0) start = Math.max(start, t); else end = Math.min(end, t);
    }
    if (!visible || end - start <= EPS || Math.hypot(dx, dy) < EPS) { chain = []; continue; }
    const a: Point = [x + start * dx, y + start * dy], b: Point = [x + end * dx, y + end * dy];
    if (!chain.length || Math.hypot(chain.at(-2)! - a[0], chain.at(-1)! - a[1]) > EPS) {
      chain = [...a]; lines.push(chain);
    }
    chain.push(...b);
    if (end < 1) chain = [];
  }
  return lines;
}

function sectorOf([x, y]: Point, half: number): number {
  const band = (v: number): number => v < -half / 3 ? 0 : v > half / 3 ? 2 : 1;
  return band(y) * 3 + band(x);
}

function distribute(p: Line, half: number, sectors: LinearTopic['sectors']): void {
  for (let i = 2; i < p.length; i += 2) {
    const x = p[i - 2]!, y = p[i - 1]!, dx = p[i]! - x, dy = p[i + 1]! - y;
    const cuts = [0, 1];
    for (const boundary of [-half / 3, half / 3]) {
      if (Math.abs(dx) > EPS) { const t = (boundary - x) / dx; if (t > 0 && t < 1) cuts.push(t); }
      if (Math.abs(dy) > EPS) { const t = (boundary - y) / dy; if (t > 0 && t < 1) cuts.push(t); }
    }
    cuts.sort((a, b) => a - b);
    for (let j = 1; j < cuts.length; j++) {
      const a = cuts[j - 1]!, b = cuts[j]!, mid = (a + b) / 2;
      sectors[sectorOf([x + mid * dx, y + mid * dy], half)]!.length += Math.hypot(dx, dy) * (b - a);
    }
  }
}

function midpoint(p: Line): Point {
  let distance = lengthOf(p) / 2;
  for (let i = 2; i < p.length; i += 2) {
    const x = p[i - 2]!, y = p[i - 1]!, dx = p[i]! - x, dy = p[i + 1]! - y;
    const length = Math.hypot(dx, dy);
    if (distance <= length) return [x + dx * distance / length, y + dy * distance / length];
    distance -= length;
  }
  return [p[0]!, p[1]!];
}

function crosses(a: Line, b: Line): boolean {
  for (let i = 2; i < a.length; i += 2) for (let j = 2; j < b.length; j += 2) {
    const ax = a[i - 2]!, ay = a[i - 1]!, dx = a[i]! - ax, dy = a[i + 1]! - ay;
    const bx = b[j - 2]!, by = b[j - 1]!, ex = b[j]! - bx, ey = b[j + 1]! - by;
    const denominator = dx * ey - dy * ex;
    if (Math.abs(denominator) < EPS) continue;
    const t = ((bx - ax) * ey - (by - ay) * ex) / denominator;
    const u = ((bx - ax) * dy - (by - ay) * dx) / denominator;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true;
  }
  return false;
}

/** Analyse only geometry inside the surveyed square, independently of the current zoom. */
export function analyseTopic(survey: Pick<Survey, 'half'>, layers: readonly Layer[], id: LinearTopicId): LinearTopic;
export function analyseTopic(survey: Pick<Survey, 'half'>, layers: readonly Layer[], id: 'cholera-pump'): CholeraTopic;
export function analyseTopic(survey: Pick<Survey, 'half'>, layers: readonly Layer[], id: TopicId): TopicAnalysis;
export function analyseTopic(survey: Pick<Survey, 'half'>, layers: readonly Layer[], id: TopicId): TopicAnalysis {
  if (id === 'cholera-pump') {
    const evidence = analyseCholera(layers);
    const broad = evidence.pumps.find((p) => p.broad);
    return {
      id, ...evidence,
      places: [
        ...(broad ? [{ name: broad.name, point: broad.point, kind: 'pump' as const }] : []),
        ...[...evidence.landmarks].sort((a, b) => a.kind.localeCompare(b.kind)),
      ],
    };
  }
  const { half } = survey;
  const square: Rect = [-half, -half, half, half];
  const canals = id === 'canal-crossings' ? featuresOf(layers, 'waterways', 'lines').filter((w) => w.k === 'canal' && !isTunnel(w))
    .flatMap((w) => clipLine(w.g, square).map((g) => ({ ...w, g }))) : [];
  const waters = new Map<Feature<Line>, string[]>();
  const canalNames = new Set<string>();
  const segments = featuresOf(layers, 'roads', 'lines').filter((r) => !isTunnel(r) && (id === 'steps' ? r.k === 'steps' : isBridge(r)))
    .flatMap((r) => clipLine(r.g, square).map((g) => ({ ...r, g })));
  const selected = segments.filter((r) => {
    if (id === 'steps') return true;
    const crossed = canals.filter((w) => crosses(r.g, w.g));
    const names = [...new Set(crossed.flatMap((w) => w.n ? [w.n] : []))].sort();
    waters.set(r, names);
    for (const n of names) canalNames.add(n);
    return crossed.length > 0;
  });
  const sectors = Array.from({ length: 9 }, () => ({ length: 0 }));
  const named = new Map<string, { lines: Line[]; length: number; waters: Set<string> }>();
  let length = 0;
  for (const r of selected) {
    const metres = lengthOf(r.g);
    length += metres;
    distribute(r.g, half, sectors);
    if (r.n) {
      const group = named.get(r.n) ?? { lines: [], length: 0, waters: new Set<string>() };
      group.lines.push(r.g); group.length += metres;
      for (const n of waters.get(r) ?? []) group.waters.add(n);
      named.set(r.n, group);
    }
  }
  const candidates: TopicPlace[] = [...named].map(([name, group]) => {
    const point = midpoint(group.lines.sort((a, b) => lengthOf(b) - lengthOf(a))[0]!);
    return { name, point, length: group.length, sector: sectorOf(point, half), waters: [...group.waters].sort() };
  }).sort((a, b) => b.length - a.length || a.name.localeCompare(b.name, 'en'));
  const places: TopicPlace[] = [];
  for (const p of candidates) {
    if (places.every((q) => Math.hypot(p.point[0] - q.point[0], p.point[1] - q.point[1]) > half * 0.25)) places.push(p);
    if (places.length === 3) break;
  }
  return { id, segments: selected, length, sectors, places, canals: [...canalNames].sort() };
}
