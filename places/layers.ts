// The external layers of each place, by place id then layer id: GeoJSON files kept in
// layers/<place>/<id>.geojson and converted by npm run layers -- <place-id> into
// public/data/<place>/<id>.json. The id "osm" is reserved. Runs in the browser and in Node.
import type { LayerSource } from '../src/layers.ts';
import type { PlaceId } from './index.ts';

export const LAYERS: { readonly [P in PlaceId]?: Readonly<Record<string, LayerSource>> } = {
  'lisbonne-alfama': {
    // Elementos de Água, Município de Lisboa (CC0), TIPOLOGIA = Chafariz inside the square:
    // https://dados.gov.pt/datasets/elementos-de-agua, downloaded 2026-11-16.
    chafarizes: {
      title: { fr: 'Chafarizes (fontaines publiques)', en: 'Chafarizes (public fountains)', es: 'Chafarizes (fuentes públicas)' },
      file: 'layers/lisbonne-alfama/chafarizes.geojson',
      kind: 'points',
      role: 'overlay',
      attribution: 'Município de Lisboa, Elementos de Água (CC0)',
      nameField: 'DESIGNACAO',
    },
  },
};

/** Where a layer file lives, relative to the site root (public/ on disk). */
export const layerPath = (place: PlaceId, id: string): string => `data/${place}/${id}.json`;
