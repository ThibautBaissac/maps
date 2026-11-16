// OpenStreetMap data (MapData) seen as layers, in the order the styles draw them. The layer
// id is its role. Runs in the browser and in Node: no DOM, no Node API.
import type { MapData } from './data.ts';
import type { Feature, Layer } from './layers.ts';

const base = { source: 'openstreetmap' } as const;

export function osmLayers(data: MapData): Layer[] {
  const { attribution } = data.meta;
  return [
    {
      ...base, id: 'buildings', role: 'buildings', kind: 'areas', attribution,
      features: data.buildings.map((g): Feature<number[][]> => ({ g })),
    },
    {
      ...base, id: 'roads', role: 'roads', kind: 'lines', attribution,
      features: data.roads.map((r): Feature<number[]> => ({
        g: r.p, k: r.k, ...(r.n !== undefined && { n: r.n }), ...(r.b || r.u ? { p: { ...(r.b && { bridge: true }), ...(r.u && { tunnel: true }) } } : {}),
      })),
    },
    {
      ...base, id: 'waterways', role: 'waterways', kind: 'lines', attribution,
      features: data.waterways.map((w): Feature<number[]> => ({
        g: w.p, k: w.k, ...(w.n !== undefined && { n: w.n }), ...(w.u && { p: { tunnel: true } }),
      })),
    },
    {
      ...base, id: 'water', role: 'water', kind: 'areas', attribution,
      features: data.water.map((w): Feature<number[][]> => ({ g: w.r, ...(w.n !== undefined && { n: w.n }) })),
    },
    {
      ...base, id: 'parks', role: 'parks', kind: 'areas', attribution,
      features: data.parks.map((p): Feature<number[][]> => ({ g: p.r, k: p.k })),
    },
  ];
}
