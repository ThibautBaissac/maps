# Données en couches : OSM devient une couche parmi d'autres

## Problem statement

Toutes les données dessinées viennent d'OpenStreetMap, par un format figé (`MapData` : `buildings`, `roads`, `waterways`, `water`, `parks`). Ajouter une information extérieure (points d'intérêt, tracés historiques, données ouvertes d'une ville) oblige à ajouter un champ à `MapData`, à modifier `scripts/osm.ts`, et à retoucher chaque style. Chaque source de plus alourdit tous les styles.

## Solution

Un modèle unique de **couche** : un ensemble d'objets de même géométrie (points, lignes ou surfaces), en mètres locaux, avec un rôle, une attribution et une source. OSM produit cinq couches de rôle fixe ; toute autre source produit des couches de rôle `overlay`. Les styles et les sujets lisent des couches par rôle, sans savoir d'où elles viennent.

La migration se fait en deux temps :

1. **Expand** : les couches extérieures arrivent à côté de `MapData`. Format, conversion GeoJSON, registre, chargement, validation au build, dessin générique. Rien d'existant ne casse.
2. **Migrate + contract** : OSM passe au format couche, les consommateurs migrent un par un, puis `MapData` disparaît.

## Décisions

- Une couche a un seul `kind` : `points`, `lines` ou `areas`.
- Un objet : `{ g, k?, n?, p? }` : géométrie, catégorie, nom, propriétés scalaires.
- Rôles : `overlay` en phase 1 ; `buildings`, `roads`, `waterways`, `water`, `parks` s'ajoutent en phase 2, réservés à OSM.
- Fichier publié : `LayerFile = { square, layers, fetchedAt?, server?, osmTimestamp? }`. `square` (`lat`, `lon`, `sizeKm`) permet au build de détecter des données téléchargées pour un autre carré.
- Emplacements : sources extérieures dans `layers/<place>/<id>.geojson` (versionnées) ; couches publiées dans `public/data/<place>/<id>.json` ; OSM dans `public/data/<place>/osm.json` à la fin de la phase 2.
- Déclaration des couches extérieures : `places/layers.ts`, avec titre localisé, fichier source, rôle, kind, attribution, et champs GeoJSON utilisés pour `n` et `k`.
- Une carte choisit ses couches extérieures dans `src/registry.ts` (`layers?: string[]`).
- Seul GeoJSON est importé en phase 1. CSV et raster sont hors périmètre.
- Les objets entièrement hors du carré sont écartés à la conversion. Les autres sont gardés entiers ; les styles éliminent ce qui sort de l'écran.

## Global constraints

- Node 24 ou plus ; aucune dépendance hors du lockfile actuel.
- `src/layers.ts`, `src/geo.ts` et `places/layers.ts` tournent dans le navigateur et sous Node : ni DOM, ni API Node.
- Coordonnées en mètres locaux, x vers l'est, y vers le nord, origine au centre du lieu, arrondies à 0,1 m, par la même projection que `scripts/osm.ts`.
- Identifiants de couche : `isSlug` (`[a-z0-9-]+`) ; `osm` est réservé.
- Chaque couche porte une attribution non vide, affichée sur la page de la carte.
- Aucune requête vers un serveur extérieur depuis les pages.
- Fin de chaque tâche : `npm test` et `npm run typecheck` verts ; `npm run build` vert à la fin de chaque phase.
- La phase 2 ne change aucun pixel : vignettes régénérées identiques.

## Testing decisions

- Seams : `parseLayer` / `parseLayerFile` (`src/layers.ts`), `localProjection` / `survey` (`src/geo.ts`), `geojsonLayer` (`scripts/geojson.ts`), `problemsOf` (`src/catalogue.ts`), `pageHtml` (`scripts/pages.ts`), `describeMap`, `analyseTopic`, `drawLayers` et le rendu des styles via le contexte enregistreur de `tests/dom.ts`.
- Non testés directement : les commandes `scripts/build-layers.ts` et `scripts/fetch-osm.ts` (fines, vérifiées en les lançant) ; `src/map-page.ts` (vérifié dans le navigateur).
- Non-régression de la phase 2 : les tests existants gardent leurs valeurs attendues ; vignettes régénérées comparées à celles du dépôt.

## Hors périmètre

- Import CSV, jointure de données attributaires sur des objets OSM, rasters géoréférencés.
- Sujets (`topics`) qui exploitent des couches extérieures : possible après la phase 2, à spécifier à part.
- Choix des premières données extérieures réelles.
