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
  'londres-soho': {
    // Digitised from John Snow's Map 1, On the Mode of Communication of Cholera (1855), public
    // domain: https://commons.wikimedia.org/wiki/File:Snow-cholera-map-1.jpg, downloaded
    // 2026-11-17. Method in layers/londres-soho/README.md.
    pompes: {
      title: { fr: 'Pompes à eau de 1854', en: 'Water pumps of 1854', es: 'Bombas de agua de 1854' },
      file: 'layers/londres-soho/pompes.geojson',
      kind: 'points',
      role: 'overlay',
      attribution: 'John Snow, 1855 (public domain), digitised for this site',
      nameField: 'name',
      categoryField: 'kind',
    },
    deces: {
      title: { fr: 'Décès du choléra, août-septembre 1854', en: 'Cholera deaths, August–September 1854', es: 'Muertes por cólera, agosto-septiembre de 1854' },
      file: 'layers/londres-soho/deces.geojson',
      kind: 'points',
      role: 'overlay',
      attribution: 'John Snow, 1855 (public domain), digitised for this site',
    },
    reperes: {
      title: { fr: 'Lieux cités par Snow', en: 'Places Snow wrote about', es: 'Lugares citados por Snow' },
      file: 'layers/londres-soho/reperes.geojson',
      kind: 'points',
      role: 'overlay',
      attribution: 'John Snow, 1855 (public domain), digitised for this site',
      nameField: 'name',
      categoryField: 'kind',
    },
  },
};

/** Where a layer file lives, relative to the site root (public/ on disk). */
export const layerPath = (place: PlaceId, id: string): string => `data/${place}/${id}.json`;
