// The external layers of each place, by place id then layer id: GeoJSON files kept in
// layers/<place>/<id>.geojson and converted by npm run layers -- <place-id> into
// public/data/<place>/<id>.json. The id "osm" is reserved. Runs in the browser and in Node.
import type { LayerSource } from '../src/layers.ts';
import type { PlaceId } from './index.ts';

// Credit of the three layers digitised from John Snow's map.
const SNOW_CREDIT = {
  fr: 'John Snow, 1855 (domaine public), numérisé pour ce site',
  en: 'John Snow, 1855 (public domain), digitised for this site',
  es: 'John Snow, 1855 (dominio público), digitalizado para este sitio',
  pt: 'John Snow, 1855 (domínio público), digitalizado para este site',
  de: 'John Snow, 1855 (gemeinfrei), für diese Website digitalisiert',
};

// Credit of the investigations register, compiled for this site from L214's public pages.
const L214_CREDIT = {
  fr: 'Enquêtes : relevé pour ce site d’après l214.com/enquetes',
  en: 'Investigations: compiled for this site from l214.com/enquetes',
  es: 'Investigaciones: recopiladas para este sitio a partir de l214.com/enquetes',
  pt: 'Investigações: compiladas para este site a partir de l214.com/enquetes',
  de: 'Recherchen: für diese Website zusammengestellt nach l214.com/enquetes',
};

export const LAYERS: { readonly [P in PlaceId]?: Readonly<Record<string, LayerSource>> } = {
  france: {
    // Départements of metropolitan France and their region code: simplified IGN Admin Express
    // COG 2018 outlines from https://github.com/gregoiredavid/france-geojson (Licence Ouverte),
    // region codes from https://geo.api.gouv.fr/departements, downloaded 2026-11-18.
    departements: {
      title: { fr: 'Départements', en: 'Départements', es: 'Departamentos', pt: 'Departamentos', de: 'Départements' },
      file: 'layers/france/departements.geojson',
      kind: 'areas',
      role: 'base',
      attribution: { fr: 'IGN, Admin Express (Licence Ouverte)', en: 'IGN, Admin Express (Licence Ouverte)', es: 'IGN, Admin Express (Licence Ouverte)', pt: 'IGN, Admin Express (Licence Ouverte)', de: 'IGN, Admin Express (Licence Ouverte)' },
      nameField: 'nom',
      categoryField: 'code',
    },
    // Main rivers: Natural Earth 1:10m rivers and lake centerlines (public domain),
    // https://github.com/nvkelso/natural-earth-vector, downloaded 2026-11-18, names in French.
    fleuves: {
      title: { fr: 'Grands cours d’eau', en: 'Main rivers', es: 'Ríos principales', pt: 'Rios principais', de: 'Große Flüsse' },
      file: 'layers/france/fleuves.geojson',
      kind: 'lines',
      role: 'base',
      attribution: { fr: 'Natural Earth (domaine public)', en: 'Natural Earth (public domain)', es: 'Natural Earth (dominio público)', pt: 'Natural Earth (domínio público)', de: 'Natural Earth (gemeinfrei)' },
      nameField: 'name',
    },
    // Capitals of the 13 metropolitan regions, for orientation: commune centres from
    // https://geo.api.gouv.fr (Licence Ouverte), downloaded 2026-11-18.
    villes: {
      title: { fr: 'Chefs-lieux de région', en: 'Regional capitals', es: 'Capitales regionales', pt: 'Capitais regionais', de: 'Regionshauptstädte' },
      file: 'layers/france/villes.geojson',
      kind: 'points',
      role: 'base',
      attribution: { fr: 'geo.api.gouv.fr (Licence Ouverte)', en: 'geo.api.gouv.fr (Licence Ouverte)', es: 'geo.api.gouv.fr (Licence Ouverte)', pt: 'geo.api.gouv.fr (Licence Ouverte)', de: 'geo.api.gouv.fr (Licence Ouverte)' },
      nameField: 'nom',
    },
    // Investigations published on https://www.l214.com/enquetes/, located from their own pages
    // and geocoded with https://geo.api.gouv.fr (Licence Ouverte), 2026-11-18. Method in
    // layers/france/README.md.
    enquetes: {
      title: { fr: 'Enquêtes de L214', en: 'L214 investigations', es: 'Investigaciones de L214', pt: 'Investigações da L214', de: 'Recherchen von L214' },
      file: 'layers/france/enquetes.geojson',
      kind: 'points',
      role: 'overlay',
      attribution: L214_CREDIT,
      nameField: 'title',
      categoryField: 'site',
    },
  },
  'lisbonne-alfama': {
    // Elementos de Água, Município de Lisboa (CC0), TIPOLOGIA = Chafariz inside the square:
    // https://dados.gov.pt/datasets/elementos-de-agua, downloaded 2026-11-16.
    chafarizes: {
      title: { fr: 'Chafarizes (fontaines publiques)', en: 'Chafarizes (public fountains)', es: 'Chafarizes (fuentes públicas)', pt: 'Chafarizes (fontanários públicos)', de: 'Chafarizes (öffentliche Brunnen)' },
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
      title: { fr: 'Pompes à eau de 1854', en: 'Water pumps of 1854', es: 'Bombas de agua de 1854', pt: 'Bombas de água de 1854', de: 'Wasserpumpen von 1854' },
      file: 'layers/londres-soho/pompes.geojson',
      kind: 'points',
      role: 'overlay',
      attribution: SNOW_CREDIT,
      nameField: 'name',
      categoryField: 'kind',
    },
    deces: {
      title: { fr: 'Décès du choléra, août-septembre 1854', en: 'Cholera deaths, August–September 1854', es: 'Muertes por cólera, agosto-septiembre de 1854', pt: 'Mortes por cólera, agosto-setembro de 1854', de: 'Cholera-Todesfälle, August–September 1854' },
      file: 'layers/londres-soho/deces.geojson',
      kind: 'points',
      role: 'overlay',
      attribution: SNOW_CREDIT,
    },
    reperes: {
      title: { fr: 'Lieux cités par Snow', en: 'Places Snow wrote about', es: 'Lugares citados por Snow', pt: 'Locais citados por Snow', de: 'Von Snow genannte Orte' },
      file: 'layers/londres-soho/reperes.geojson',
      kind: 'points',
      role: 'overlay',
      attribution: SNOW_CREDIT,
      nameField: 'name',
      categoryField: 'kind',
    },
  },
};

/** Where a layer file lives, relative to the site root (public/ on disk). */
export const layerPath = (place: PlaceId, id: string): string => `data/${place}/${id}.json`;
