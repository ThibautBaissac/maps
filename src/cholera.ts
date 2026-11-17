// The 1854 Broad Street cholera subject: which pump each recorded death is closest to on
// foot. Deaths, pumps and landmarks come from external point layers, recognised by their
// properties (p.deaths, k = pump | broad-street, k = workhouse | brewery); walking distances
// follow the OpenStreetMap streets of today. Pure: runs in the browser and in Node.
import { featuresOf, isTunnel, type Layer } from './layers.ts';
import type { Point } from './toolkit/geometry.ts';

export interface CholeraPump {
  name: string;
  point: Point;
  /** The Broad Street pump. */
  broad: boolean;
  /** Recorded deaths closest to this pump on foot. */
  deaths: number;
}

export interface CholeraDeath {
  point: Point;
  /** Deaths recorded at this address. */
  count: number;
  /** Index into `pumps` of the closest pump on foot, -1 if no street reaches one. */
  pump: number;
  /** Walking distance to that pump, metres. */
  walk: number;
}

export interface CholeraLandmark {
  name: string;
  point: Point;
  kind: 'workhouse' | 'brewery';
}

export interface CholeraEvidence {
  pumps: CholeraPump[];
  deaths: CholeraDeath[];
  landmarks: CholeraLandmark[];
  /** Sum of the recorded deaths. */
  total: number;
  /** Deaths closest on foot to the Broad Street pump. */
  broad: number;
  /** Deaths within 100 m on foot of the Broad Street pump, whichever pump is closest. */
  within100: number;
}

/** Side of the snapping grid cells, metres. */
const CELL = 25;

interface Snap { a: number; b: number; t: number; length: number; offset: number }

/** Street graph: vertices shared by OSM ways at junctions, segments for snapping. */
class Streets {
  readonly xy: number[] = [];
  readonly edges: [number, number][][] = [];
  segments: [number, number, number][] = []; // a, b, length
  private readonly ids = new Map<string, number>();
  /** Segment indices by grid cell. */
  private readonly grid = new Map<string, number[]>();

  constructor(layers: readonly Layer[]) {
    for (const road of featuresOf(layers, 'roads', 'lines')) {
      if (isTunnel(road)) continue;
      const g = road.g;
      for (let i = 2; i < g.length; i += 2) {
        const a = this.vertex(g[i - 2]!, g[i - 1]!), b = this.vertex(g[i]!, g[i + 1]!);
        const length = Math.hypot(g[i]! - g[i - 2]!, g[i + 1]! - g[i - 1]!);
        if (a === b) continue;
        this.edges[a]!.push([b, length]);
        this.edges[b]!.push([a, length]);
        this.segments.push([a, b, length]);
      }
    }
    // Snap only onto the largest connected network: courtyards and paths mapped inside
    // blocks, unconnected to the streets, would leave a death unreachable.
    const component = new Int32Array(this.xy.length / 2).fill(-1), sizes: number[] = [];
    for (let start = 0; start < component.length; start++) {
      if (component[start]! >= 0) continue;
      const id = sizes.length, stack = [start];
      component[start] = id; sizes.push(0);
      while (stack.length) {
        const v = stack.pop()!;
        sizes[id]!++;
        for (const [w] of this.edges[v]!) if (component[w]! < 0) { component[w] = id; stack.push(w); }
      }
    }
    const main = sizes.indexOf(Math.max(...sizes));
    this.segments = this.segments.filter(([a]) => component[a] === main);
    for (let i = 0; i < this.segments.length; i++) {
      const [a, b] = this.segments[i]!;
      const x0 = Math.min(this.xy[2 * a]!, this.xy[2 * b]!), x1 = Math.max(this.xy[2 * a]!, this.xy[2 * b]!);
      const y0 = Math.min(this.xy[2 * a + 1]!, this.xy[2 * b + 1]!), y1 = Math.max(this.xy[2 * a + 1]!, this.xy[2 * b + 1]!);
      for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
        for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
          const key = `${cx},${cy}`;
          const list = this.grid.get(key);
          if (list) list.push(i); else this.grid.set(key, [i]);
        }
      }
    }
  }

  private vertex(x: number, y: number): number {
    const key = `${x},${y}`;
    let id = this.ids.get(key);
    if (id === undefined) {
      id = this.xy.length / 2;
      this.ids.set(key, id);
      this.xy.push(x, y);
      this.edges.push([]);
    }
    return id;
  }

  /** Closest point on a street of the main network, searching rings of grid cells outwards. */
  snap([x, y]: Point): Snap | undefined {
    let best: Snap | undefined;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    for (let ring = 0; ring < 40; ring++) {
      for (let i = cx - ring; i <= cx + ring; i++) {
        for (let j = cy - ring; j <= cy + ring; j++) {
          if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== ring) continue;
          for (const k of this.grid.get(`${i},${j}`) ?? []) {
            const [a, b, length] = this.segments[k]!;
            const ax = this.xy[2 * a]!, ay = this.xy[2 * a + 1]!, dx = this.xy[2 * b]! - ax, dy = this.xy[2 * b + 1]! - ay;
            const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (length * length)));
            const offset = Math.hypot(ax + t * dx - x, ay + t * dy - y);
            if (!best || offset < best.offset) best = { a, b, t, length, offset };
          }
        }
      }
      // Any segment beyond this ring is at least ring * CELL away.
      if (best && best.offset <= ring * CELL) return best;
    }
    return best;
  }
}

/** Multi-source Dijkstra: for each vertex, the distance to the closest source and its index. */
function nearestSources(streets: Streets, sources: (Snap | undefined)[]): { dist: Float64Array; from: Int32Array } {
  const n = streets.xy.length / 2;
  const dist = new Float64Array(n).fill(Infinity), from = new Int32Array(n).fill(-1);
  const heap: [number, number, number][] = []; // distance, vertex, source
  const push = (item: [number, number, number]): void => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (heap[parent]![0] <= heap[i]![0]) break;
      [heap[parent], heap[i]] = [heap[i]!, heap[parent]!];
      i = parent;
    }
  };
  const pop = (): [number, number, number] => {
    const top = heap[0]!, last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      for (let i = 0; ;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i]!, heap[m]!];
        i = m;
      }
    }
    return top;
  };
  sources.forEach((s, index) => {
    if (!s) return;
    push([s.offset + s.t * s.length, s.a, index]);
    push([s.offset + (1 - s.t) * s.length, s.b, index]);
  });
  while (heap.length) {
    const [d, v, source] = pop();
    if (d >= dist[v]!) continue;
    dist[v] = d; from[v] = source;
    for (const [w, length] of streets.edges[v]!) if (d + length < dist[w]!) push([d + length, w, source]);
  }
  return { dist, from };
}

/** Walking distance from a snapped point to the closest source, through its segment's ends. */
function closest(s: Snap, sources: (Snap | undefined)[], { dist, from }: ReturnType<typeof nearestSources>): { index: number; walk: number } {
  let index = -1, walk = Infinity;
  const consider = (i: number, d: number): void => { if (i >= 0 && d < walk) { index = i; walk = d; } };
  consider(from[s.a]!, s.offset + s.t * s.length + dist[s.a]!);
  consider(from[s.b]!, s.offset + (1 - s.t) * s.length + dist[s.b]!);
  // A source on the same segment is reached without passing a vertex.
  sources.forEach((p, i) => {
    if (p && ((p.a === s.a && p.b === s.b) || (p.a === s.b && p.b === s.a))) {
      const tp = p.a === s.a ? p.t : 1 - p.t;
      consider(i, s.offset + p.offset + Math.abs(s.t - tp) * s.length);
    }
  });
  return { index, walk };
}

export function analyseCholera(layers: readonly Layer[]): CholeraEvidence {
  const points = featuresOf(layers, 'overlay', 'points');
  const pumps: CholeraPump[] = points.filter((f) => f.k === 'pump' || f.k === 'broad-street')
    .map((f) => ({ name: f.n ?? '', point: [f.g[0], f.g[1]], broad: f.k === 'broad-street', deaths: 0 }));
  const landmarks: CholeraLandmark[] = points.flatMap((f): CholeraLandmark[] =>
    f.k === 'workhouse' || f.k === 'brewery' ? [{ name: f.n ?? '', point: [f.g[0], f.g[1]], kind: f.k }] : []);
  const records = points.flatMap((f) => typeof f.p?.['deaths'] === 'number' ? [{ point: [f.g[0], f.g[1]] as Point, count: f.p['deaths'] }] : []);

  const streets = new Streets(layers);
  const sources = pumps.map((p) => streets.snap(p.point));
  const reach = nearestSources(streets, sources);
  const broadIndex = pumps.findIndex((p) => p.broad);
  const broadSources = sources.map((s, i) => (i === broadIndex ? s : undefined));
  const broadOnly = broadIndex >= 0 ? nearestSources(streets, broadSources) : undefined;

  let total = 0, broad = 0, within100 = 0;
  const deaths = records.map(({ point, count }): CholeraDeath => {
    total += count;
    const s = streets.snap(point);
    const { index, walk } = s ? closest(s, sources, reach) : { index: -1, walk: Infinity };
    if (index >= 0) pumps[index]!.deaths += count;
    if (index >= 0 && index === broadIndex) broad += count;
    if (s && broadOnly && closest(s, broadSources, broadOnly).walk <= 100) within100 += count;
    return { point, count, pump: index, walk };
  });
  return { pumps, deaths, landmarks, total, broad, within100 };
}
