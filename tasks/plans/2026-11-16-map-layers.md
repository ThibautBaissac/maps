# Données en couches Implementation Plan

**Goal:** dessiner sur les cartes des données extérieures versionnées dans le projet, puis faire d'OSM une couche parmi d'autres.

**Architecture:** un type `Layer` (points, lignes ou surfaces en mètres locaux, avec rôle et attribution) et un fichier publié `LayerFile`. Phase 1 (tâches 1 à 6) : couches extérieures à côté de `MapData`, sans rien casser. Phase 2 (tâches 7 à 13) : OSM converti en couches par un adaptateur, consommateurs migrés un par un, nouveau format de fichier, puis suppression de `MapData`.

**Tech stack:** TypeScript 7 strict, Vite 8, Node 24 (`node:test`, `node:assert/strict`), Canvas 2D.

**Spec:** `tasks/specs/2026-11-16-map-layers.md`

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

## File structure

Phase 1 :
- `src/layers.ts` (create) : types `Layer`, `LayerFile`, `LayerSource`, validation `parseLayer` / `parseLayerFile`.
- `src/geo.ts` (create) : projection locale et carré relevé, partagés par OSM et GeoJSON.
- `scripts/osm.ts`, `scripts/coastline.ts` (modify) : utilisent `src/geo.ts`.
- `scripts/geojson.ts` (create) : conversion pure GeoJSON → `Layer`.
- `scripts/build-layers.ts` (create) : commande `npm run layers -- <place>`.
- `places/layers.ts` (create) : déclaration des couches extérieures par lieu.
- `layers/<place>/<id>.geojson` (convention) : sources extérieures versionnées.
- `src/registry.ts`, `src/catalogue.ts` (modify) : `layers` par carte, chemins, contrôles au build.
- `src/map-page.ts`, `src/styles/contract.ts`, `src/map-description.ts`, `scripts/pages.ts` (modify) : chargement, contrat, description, attribution.
- `src/toolkit/layers.ts` (create) : dessin générique des couches `overlay`.
- `src/styles/riso/index.ts`, `src/styles/cyanotype/index.ts` (modify) : appellent `drawLayers`.

Phase 2 :
- `src/osm-layers.ts` (create, supprimé en tâche 13) : adaptateur `MapData` → `Layer[]`.
- `src/topics.ts`, `src/toolkit/topic.ts`, `src/topic-content.ts`, `src/topic-panel.ts`, `src/map-description.ts` (modify).
- `src/toolkit/labels.ts`, `src/toolkit/stage.ts` (modify).
- `src/styles/riso/plates.ts`, `src/styles/cyanotype/map.ts` (modify).
- `scripts/fetch-osm.ts`, `places/index.ts` (modify) : écrivent et désignent `public/data/<place>/osm.json`.
- `src/data.ts` (delete en tâche 13).

---

### Task 1: Modèle de couche

**Files:**
- Create: `src/layers.ts`
- Test: `tests/layers.test.ts`

**Interfaces:**
- Consumes: `Line`, `Ring` de `src/data.ts` ; `isRecord`, `isSlug` de `src/place.ts` ; `Point` de `src/toolkit/geometry.ts` (`[number, number]`) ; `LocalizedText` de `src/i18n/index.ts`.
- Produces (tous exportés de `src/layers.ts`) :
  - `LAYER_KINDS = ['points', 'lines', 'areas'] as const`, `type LayerKind`.
  - `LAYER_ROLES = ['overlay'] as const`, `type LayerRole`.
  - `type Geometry<K extends LayerKind> = K extends 'points' ? Point : K extends 'lines' ? Line : Ring[]`.
  - `type Scalar = string | number | boolean`.
  - `interface Feature<G> { g: G; k?: string; n?: string; p?: Readonly<Record<string, Scalar>> }`.
  - `interface LayerOf<K extends LayerKind> { id: string; kind: K; role: LayerRole; attribution: string; source: string; features: Feature<Geometry<K>>[] }`.
  - `type Layer = LayerOf<'points'> | LayerOf<'lines'> | LayerOf<'areas'>`.
  - `interface Square { lat: number; lon: number; sizeKm: number }`.
  - `interface LayerFile { square: Square; layers: Layer[]; fetchedAt?: string; server?: string; osmTimestamp?: string }`.
  - `interface LayerSource { title: LocalizedText; file: string; kind: LayerKind; role: LayerRole; attribution: string; nameField?: string; categoryField?: string }`.
  - `parseLayer(v: unknown, source: string): Layer` et `parseLayerFile(v: unknown, source: string): LayerFile`, qui lèvent `Error` avec un message préfixé par `${source}: `.
  - `featuresOf<K extends LayerKind>(layers: readonly Layer[], role: LayerRole, kind: K): Feature<Geometry<K>>[]` : concatène les objets des couches de ce rôle et de ce kind, dans l'ordre des couches.

**Risk:** normal

- [x] **Step 1: Write the failing tests**

  Couche valide de référence `FOUNTAINS` : `{ id: 'fontaines', kind: 'points', role: 'overlay', attribution: '© Ville de Lisbonne (CC BY 4.0)', source: 'layers/lisbonne-alfama/fontaines.geojson', features: [{ g: [10, 20], n: 'Chafariz d’El-Rei', k: 'fontaine', p: { eau: true, annee: 1220 } }] }`.
  - `parseLayer(FOUNTAINS, 'f')` → valeur égale (`deepEqual`).
  - `kind: 'polygons'` → lève `f: kind must be points, lines or areas`.
  - `role: 'roads'` → lève `f: role must be overlay`.
  - `id: 'Fontaines'` → lève `f: invalid id "Fontaines" (use a-z, 0-9 and -)`.
  - `attribution: ''` → lève `f: attribution must be a non-empty string`.
  - `features: {}` → lève `f: features must be an array`.
  - points, `g: [10]` → lève `f: feature 0: points need [x, y]`.
  - lines, `g: [0, 0]` → lève `f: feature 0: lines need at least two [x, y] pairs`.
  - areas, `g: [[0, 0, 1, 0]]` → lève `f: feature 0: areas need rings of at least three [x, y] pairs`.
  - `p: { a: { b: 1 } }` → lève `f: feature 0: p values must be strings, numbers or booleans`.
  - `n: 3` → lève `f: feature 0: n must be a string`.
  - `parseLayerFile({ square: { lat: 38.7118, lon: -9.1284, sizeKm: 2 }, layers: [FOUNTAINS] }, 'file')` → valeur égale.
  - `parseLayerFile({ layers: [] }, 'file')` → lève `file: square must hold lat, lon and sizeKm numbers`.
  - `parseLayerFile` avec deux couches d'id `fontaines` → lève `file: duplicate layer "fontaines"`.
  - `featuresOf([FOUNTAINS, lignesOverlay], 'overlay', 'points')` → seulement l'objet de `FOUNTAINS`.

- [x] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/layers.test.ts`
  Expected: FAIL, module `../src/layers.ts` introuvable.

- [x] **Step 3: Implement `src/layers.ts`**

  Validation complète de chaque objet (contrairement à `parseMapData`) : les fichiers sont versionnés et peuvent être édités à la main. Chaque coordonnée doit être un nombre fini, sinon `feature <i>: coordinates must be finite numbers`. Commentaire d'en-tête dans le style des autres modules : rôle du fichier, « Runs in the browser and in Node ».

- [x] **Step 4: Run the tests and watch them pass**

  Run: `node --test tests/layers.test.ts && npm run typecheck`
  Expected: PASS

- [x] **Step 5: Commit**

  ```bash
  git add src/layers.ts tests/layers.test.ts
  git commit -m "Add the map layer model"
  ```

### Task 2: Projection locale partagée

**Files:**
- Create: `src/geo.ts`
- Modify: `scripts/osm.ts:34-44` (constantes `R`, `toRad`, `survey`) et `scripts/osm.ts:142-157` (projection dans `convertOsm`)
- Modify: `scripts/coastline.ts:5` (`r1`)
- Test: `tests/geo.test.ts`

**Interfaces:**
- Consumes: `Place` de `src/place.ts` ; `BBox` de `src/data.ts` ; `Point` de `src/toolkit/geometry.ts`.
- Produces (exportés de `src/geo.ts`) :
  - `r1(v: number): number` (déplacé depuis `scripts/coastline.ts`, qui l'importe désormais et le réexporte pour ne pas toucher ses autres importateurs).
  - `survey(place: Square | Place): { half: number; bbox: BBox }` (déplacé depuis `scripts/osm.ts`, même calcul).
  - `localProjection(place: Square | Place): (lat: number, lon: number) => Point` : `[r1((lon - place.lon) * kx), r1((lat - place.lat) * ky)]` avec `kx = R · toRad(1) · cos(toRad(place.lat))`, `ky = R · toRad(1)`, `R = 6371008.8`.

**Risk:** normal

- [x] **Step 1: Write the failing tests**

  Avec `PLACES['amsterdam-centre']` et `KX = 67889.41512315086`, `KY = 111195.0802335329` :
  - `localProjection(place)(52.3712, 4.8936)` → `[0, 0]`.
  - `localProjection(place)(52.3712 + 100 / KY, 4.8936 + 50 / KX)` → `[50, 100]`.
  - `localProjection(place)(52.3712 + 0.04 / KY, 4.8936)` → `[0, 0]` (arrondi à 0,1 m).
  - `survey(place).half` → `1000`.

- [x] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/geo.test.ts`
  Expected: FAIL, module introuvable.

- [x] **Step 3: Move the projection**

  `convertOsm` projette avec `localProjection(place)` ; plus aucune constante de projection dans `scripts/osm.ts`. `tests/osm.test.ts` ne change pas.

- [x] **Step 4: Run the tests and watch them pass**

  Run: `npm test && npm run typecheck`
  Expected: PASS, dont `tests/osm.test.ts` inchangé.

- [x] **Step 5: Commit**

  ```bash
  git add src/geo.ts scripts/osm.ts scripts/coastline.ts tests/geo.test.ts
  git commit -m "Share the local projection between data converters"
  ```

### Task 3: Conversion GeoJSON et commande `layers`

**Files:**
- Create: `scripts/geojson.ts`, `scripts/build-layers.ts`, `places/layers.ts`
- Modify: `package.json` (script `"layers": "node scripts/build-layers.ts"`), `AGENTS.md` (structure et commandes)
- Test: `tests/geojson.test.ts`

**Interfaces:**
- Consumes: `Layer`, `LayerFile`, `LayerSource`, `parseLayer` de `src/layers.ts` (tâche 1) ; `localProjection`, `survey` de `src/geo.ts` (tâche 2) ; `PLACES`, `PlaceId`, `isPlaceId` de `places/index.ts` ; `fail`, `message` de `scripts/cli.ts`.
- Produces :
  - `geojsonLayer(json: unknown, place: Place, id: string, spec: LayerSource): Layer` (`scripts/geojson.ts`, pur : ni fichier ni console).
  - `LAYERS: { readonly [P in PlaceId]?: Readonly<Record<string, LayerSource>> }` (`places/layers.ts`, vide au départ : `{}`).
  - `layerPath(place: PlaceId, id: string): string` → `` `data/${place}/${id}.json` `` (`places/layers.ts`).
  - Commande `npm run layers -- <place-id>` : écrit un `LayerFile` `{ square: { lat, lon, sizeKm }, layers: [layer] }` par couche déclarée dans `public/<layerPath>`.

**Risk:** normal

- [x] **Step 1: Write the failing tests**

  Place `amsterdam-centre`, helper `ll(x, y)` → `[lon, lat]` (ordre GeoJSON) construit avec `KX`/`KY` de la tâche 2. Spec de base : `{ title: 'Ponts', file: 'x.geojson', kind: 'points', role: 'overlay', attribution: '© Test', nameField: 'nom', categoryField: 'type' }`.
  - FeatureCollection d'un `Point` en `ll(10, 20)` avec `properties { nom: 'Magere Brug', type: 'pont', annee: 1934, ouvert: true, meta: { a: 1 } }` → `features` = `[{ g: [10, 20], n: 'Magere Brug', k: 'pont', p: { annee: 1934, ouvert: true } }]` ; `id`, `kind`, `role`, `attribution` copiés de la spec, `source` = `'x.geojson'`.
  - `MultiPoint` de deux points → deux objets.
  - Couche `lines`, `MultiLineString` de deux parties → deux objets `g` plats `[x0, y0, x1, y1]`.
  - Couche `areas`, `Polygon` avec un trou → un objet, `g` = deux anneaux ; `MultiPolygon` de deux polygones → deux objets.
  - `Polygon` dans une couche `lines` → lève `feature 0: Polygon in a lines layer`.
  - `geometry: null` → lève `feature 0: no geometry`.
  - `{ type: 'Feature' }` en racine → lève `not a GeoJSON FeatureCollection`.
  - Point en `ll(1500, 0)` (hors du carré de 1000 m) → écarté ; ligne de `ll(900, 0)` à `ll(1100, 0)` → gardée entière.
  - Propriété `nom` vide ou absente → pas de `n` ; aucune propriété restante → pas de `p`.
  - Le résultat passe `parseLayer` sans erreur.

- [x] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/geojson.test.ts`
  Expected: FAIL, module introuvable.

- [x] **Step 3: Implement the conversion and the command**

  `scripts/build-layers.ts` suit `scripts/fetch-osm.ts` : en-tête d'usage, `fail` pour une place inconnue (`No such place: <id>. Known: …`) ou sans couche (`No layers for <id> (places/layers.ts)`), lecture de `spec.file` relatif à la racine du dépôt, écriture, puis `console.table` id → nombre d'objets. Fichiers source rangés par convention dans `layers/<place>/<id>.geojson`. `AGENTS.md` : ajouter `places/layers.ts`, `layers/`, et la commande.

- [x] **Step 4: Run the tests and watch them pass**

  Run: `npm test && npm run typecheck`
  Expected: PASS. Vérification manuelle : déclarer temporairement une couche pour `lisbonne-alfama` avec un GeoJSON de deux points dans le scratchpad, lancer `npm run layers -- lisbonne-alfama`, lire le fichier écrit, puis tout retirer (registre vide, aucun fichier dans `public/data/lisbonne-alfama/`).

- [x] **Step 5: Commit**

  ```bash
  git add scripts/geojson.ts scripts/build-layers.ts places/layers.ts package.json AGENTS.md tests/geojson.test.ts
  git commit -m "Convert GeoJSON sources into map layers"
  ```

### Task 4: Couches dans le registre, le build et la page

**Files:**
- Modify: `src/registry.ts:9-22` (`MapEntryOf`), `src/catalogue.ts` (`CatalogueMapOf`, `resolve`, `problemsOf`), `src/styles/contract.ts:16-26` (`MountArgs`), `src/map-page.ts:29-66`, `scripts/pages.ts:63`, `src/map-description.ts:34` (`describeMap`)
- Test: `tests/catalogue.test.ts`, `tests/pages.test.ts`, `tests/descriptions.test.ts`

**Interfaces:**
- Consumes: `LAYERS`, `layerPath` de `places/layers.ts` (tâche 3) ; `Layer`, `LayerSource`, `parseLayerFile` de `src/layers.ts` (tâche 1).
- Produces :
  - `MapEntryOf.layers?: readonly string[]` (ids de `LAYERS[place]`).
  - `CatalogueMapOf.layers: readonly { id: string; title: string; path: string }[]` (titre résolu dans la langue) et `CatalogueMapOf.attributions: readonly string[]` (attributions des couches extérieures, sans doublon, dans l'ordre du registre).
  - `problemsOf(maps, readData, layers = LAYERS)`.
  - `MountArgs.layers: readonly Layer[]` (toujours présent, `[]` sans couche).
  - `describeMap(..., topic?, overlays: readonly { title: string; layer: Layer }[] = [])`.

**Risk:** normal

- [ ] **Step 1: Write the failing tests**

  `tests/catalogue.test.ts`, registre injecté `{ 'amsterdam-centre': { ponts: SPEC } }` :
  - entrée avec `layers: ['tunnels']` → problème `unknown layer "tunnels" for amsterdam-centre (<map id>); known: ponts`.
  - registre injecté déclarant une couche `osm` → `layer id "osm" is reserved (amsterdam-centre)` ; une couche `Ponts` → `invalid layer id "Ponts" for amsterdam-centre (use a-z, 0-9 and -)`.
  - `readData` renvoie `undefined` pour `data/amsterdam-centre/ponts.json` → `no data for layer "ponts" of amsterdam-centre (<map id>); run npm run layers -- amsterdam-centre`.
  - fichier dont `square.sizeKm` vaut 3 → `layer "ponts" of amsterdam-centre is out of date (<map id>): sizeKm is 2 in places/index.ts but 3 in the data; run npm run layers -- amsterdam-centre`.
  - fichier invalide → message de `parseLayerFile` préfixé par le chemin.
  - fichier valide → aucun problème ; `catalogueOf` donne `layers: [{ id: 'ponts', title: 'Ponts', path: 'data/amsterdam-centre/ponts.json' }]`.
  `tests/pages.test.ts` : carte avec `attributions: ['© Ville d’Amsterdam']` → `.attribution` contient le lien OSM puis ` · © Ville d’Amsterdam` échappé ; sans couche → HTML identique à aujourd'hui.
  `tests/descriptions.test.ts` : overlay `{ title: 'Ponts', layer }` avec un point nommé `Magere Brug` en `[0, 0]` → une section `<details>` dont le résumé vaut `Ponts (1)` et un item `Magere Brug — <position centre>.`.

- [ ] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/catalogue.test.ts tests/pages.test.ts tests/descriptions.test.ts`
  Expected: FAIL sur les nouveaux cas.

- [ ] **Step 3: Implement**

  `map-page.ts` charge les fichiers de couche en parallèle de la donnée OSM et du style, valide avec `parseLayerFile`, aplatit leurs `layers` et les passe à `mount` et à `describeMap`. Un fichier manquant fait échouer le chargement comme la donnée OSM (`Missing layer <id> for <place>: HTTP <status>`). La section de description réutilise `namedFeatures` : un point `[x, y]` est une ligne d'une seule paire.

- [ ] **Step 4: Run the tests and watch them pass**

  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/registry.ts src/catalogue.ts src/styles/contract.ts src/map-page.ts scripts/pages.ts src/map-description.ts tests/
  git commit -m "Load external layers on map pages"
  ```

### Task 5: Dessin générique des couches

**Files:**
- Create: `src/toolkit/layers.ts`
- Modify: `src/styles/riso/index.ts:115-117` (après `renderPlateB`, avant `drawTopic`), `src/styles/cyanotype/index.ts:67-72` (après `renderMap`, avant `drawTopic`), `src/styles/README.md` (argument `layers`, module `layers.ts`), `.claude/skills/new-map/references/new-style.md` (mention des couches)
- Test: `tests/rendering.test.ts`

**Interfaces:**
- Consumes: `MountArgs.layers` (tâche 4) ; `featuresOf`, `Layer` (tâche 1) ; `Projector`, `addLine`, `addRings`, `bboxOf` de `src/toolkit/projection.ts`.
- Produces: `drawLayers(ctx: CanvasRenderingContext2D, P: Projector, layers: readonly Layer[], ink: { stroke: string; fill: string; width: number; radius: number }): void`. Ne dessine que le rôle `overlay`. `width` et `radius` en px CSS, multipliés par `P.dpr`. Points : cercle `arc(sx, sy, radius · dpr)` rempli de `fill` et cerné de `stroke`. Lignes : `addLine(..., k = 0)` puis `stroke`. Surfaces : `addRings(..., k = 0)`, remplissage `fill` à `globalAlpha = 0.3`, puis contour à `globalAlpha = 1`. Objets hors écran (`P.visible`) ignorés. État du contexte restauré (`save`/`restore`).

**Risk:** normal

- [ ] **Step 1: Write the failing tests**

  Contexte enregistreur 200 × 200, `makeProjector({ x: 0, y: 0, s: 1 }, 200, 200, 1)` :
  - couche points, objet en `[0, 0]`, `radius: 4` → un appel `arc` d'arguments `(100, 100, 4, 0, 2π)`.
  - couche lines `[-10, 0, 10, 0]` → `moveTo(90, 100)` puis `lineTo(110, 100)` puis `stroke`.
  - couche areas d'un carré → `closePath`, `fill`, `stroke`.
  - objet en `[5000, 0]` → aucun appel de dessin.
  - `layers: []` → aucun appel.
  - avec `dpr = 2` et `radius: 4` → rayon 8.
  - Rendu riso et cyanotype avec `layers: []` : séquence d'appels identique à celle d'avant (enregistrée dans le test avant modification des styles).

- [ ] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/rendering.test.ts`
  Expected: FAIL, `drawLayers` introuvable.

- [ ] **Step 3: Implement and wire the styles**

  Riso : encre `ink.b`, fond `'#FFFFFF'`, largeur 1,5, rayon 4. Cyanotype : `o.line`, `o.paper`, largeur 1,5, rayon 4. Aucun changement quand la carte n'a pas de couche.

- [ ] **Step 4: Run the tests and watch them pass; check in the browser**

  Run: `npm test && npm run typecheck && npm run build`
  Expected: PASS. Puis, avec une couche temporaire (tâche 3) ajoutée à `lisbonne-cyanotype` : `npm run dev`, ouvrir `/maps/fr/cartes/lisbonne-cyanotype/`, capture d'écran, vérifier points, attribution et section de description, puis retirer la couche temporaire. Vignettes inchangées (`git status public/vignettes` vide).

- [ ] **Step 5: Commit**

  ```bash
  git add src/toolkit/layers.ts src/styles tests/rendering.test.ts .claude/skills/new-map/references/new-style.md
  git commit -m "Draw external layers in the riso and cyanotype styles"
  ```

### Task 6: Fin de la phase 1

**Files:**
- Modify: `.claude/skills/new-map/SKILL.md` (étape données : couches extérieures possibles via `places/layers.ts` et `npm run layers`)
- Test: aucun nouveau test

**Interfaces:**
- Consumes: tout ce que produisent les tâches 1 à 5.
- Produces: phase 1 livrée ; aucun nouveau symbole.

**Risk:** normal

- [ ] **Step 1: Document**

  Une section courte dans `SKILL.md` : quand proposer une couche extérieure, où ranger la source, comment déclarer l'attribution et la licence (ODbL côté OSM, licence de la source côté couche).

- [ ] **Step 2: Verify the whole phase**

  Run: `npm test && npm run typecheck && npm run build`
  Expected: PASS ; `git status` sans fichier généré ni couche temporaire.

- [ ] **Step 3: Commit**

  ```bash
  git add .claude/skills/new-map/SKILL.md
  git commit -m "Document external layers in the new-map skill"
  ```

### Task 7: Couches OSM par adaptateur

**Files:**
- Create: `src/osm-layers.ts`
- Modify: `src/layers.ts` (`LAYER_ROLES`, contrôle des rôles réservés)
- Test: `tests/osm-layers.test.ts`, `tests/layers.test.ts`

**Interfaces:**
- Consumes: `MapData` de `src/data.ts` ; `Layer`, `Feature` (tâche 1).
- Produces :
  - `LAYER_ROLES = ['buildings', 'roads', 'waterways', 'water', 'parks', 'overlay'] as const` ; `OSM_ROLES = ['buildings', 'roads', 'waterways', 'water', 'parks'] as const`.
  - `parseLayer` refuse un rôle OSM dans une couche dont l'id n'est pas celui du rôle : `role buildings is reserved for OpenStreetMap layers`. Les ids des couches OSM sont égaux à leur rôle ; `geojsonLayer` et `places/layers.ts` n'acceptent que `overlay` (type `LayerSource.role: 'overlay'`).
  - `osmLayers(data: MapData): Layer[]`, dans l'ordre `buildings` (areas, `g` = anneaux), `roads` (lines, `k` = highway, `n`, `p.bridge = true` si `b`, `p.tunnel = true` si `u`), `waterways` (lines, `k`, `n`, `p.tunnel`), `water` (areas, `n`), `parks` (areas, `k`). `attribution` = `data.meta.attribution`, `source` = `'openstreetmap'`.
  - `isBridge(f: Feature<unknown>): boolean` et `isTunnel(f: Feature<unknown>): boolean` (dans `src/layers.ts`).

**Risk:** normal

- [ ] **Step 1: Write the failing tests**

  Sur `convertOsm(ANSWER, 'amsterdam-centre', SOURCE)` (réponse de `tests/osm.test.ts`, à extraire dans `tests/fixtures/overpass.ts` pour la partager) :
  - nombre d'objets de chaque couche = longueur de la collection correspondante.
  - l'objet `Damrak` de `roads` : `{ g: [0, 0, 50, 0], k: 'residential', n: 'Damrak', p: { bridge: true } }` ; `isBridge` vrai, `isTunnel` faux.
  - le footway tunnel : `isTunnel` vrai.
  - `featuresOf(osmLayers(d), 'water', 'areas')` contient `Vijver`.
  - chaque couche passe `parseLayer`.
  - `parseLayer` d'une couche `id: 'batiments', role: 'buildings'` → lève le message de rôle réservé.

- [ ] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/osm-layers.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement the adapter**

- [ ] **Step 4: Run the tests and watch them pass**

  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/osm-layers.ts src/layers.ts tests/
  git commit -m "Expose OpenStreetMap data as layers"
  ```

### Task 8: Sujets et description sur les couches

**Files:**
- Modify: `src/topics.ts:24-30,103-147` (`TopicAnalysis.segments`, `analyseTopic`), `src/toolkit/topic.ts:40,51` (`r.p` → `f.g`), `src/topic-content.ts:6-16`, `src/topic-panel.ts:7`, `src/map-description.ts:34-70`, `src/map-page.ts`
- Test: `tests/topics.test.ts`, `tests/descriptions.test.ts`, `tests/rendering.test.ts`

**Interfaces:**
- Consumes: `osmLayers`, `isBridge`, `isTunnel`, `featuresOf` (tâches 1 et 7).
- Produces :
  - `interface Survey { half: number; sizeKm: number; lat: number; lon: number; fetchedAt: string }` (dans `src/layers.ts`).
  - `analyseTopic(survey: Pick<Survey, 'half'>, layers: readonly Layer[], id: TopicId): TopicAnalysis`, avec `TopicAnalysis.segments: Feature<Line>[]`.
  - `topicContent(survey: Survey, topic, locale)` ; `mountTopicPanel(container, survey, topic, locale, handle, dataUrl)`.
  - `describeMap(container, summary, survey: Survey, layers: readonly Layer[], display, legend, locale, topic?, overlays = [])` : les nombres viennent de `featuresOf` par rôle.
  - `map-page.ts` construit `layers = [...osmLayers(data), ...external]` et `survey` depuis `data.meta`.

**Risk:** normal

- [ ] **Step 1: Rewrite the tests at the new seams**

  `tests/topics.test.ts` : mêmes routes et cours d'eau, exprimés en couches `roads` / `waterways` (`b: 1` → `p: { bridge: true }`, `u: 1` → `p: { tunnel: true }`). Toutes les valeurs attendues restent identiques (longueur 20, secteur central 20/3, `Escadinhas` en `[0, 0]`, etc.) ; `segments.map((f) => f.g)` remplace `segments.map((r) => r.p)`. Idem dans `tests/descriptions.test.ts` (mêmes textes attendus) et `tests/rendering.test.ts` (repères).

- [ ] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/topics.test.ts tests/descriptions.test.ts tests/rendering.test.ts`
  Expected: FAIL sur la signature.

- [ ] **Step 3: Migrate the consumers**

- [ ] **Step 4: Run the tests and watch them pass**

  Run: `npm test && npm run typecheck`
  Expected: PASS avec les valeurs attendues d'origine.

- [ ] **Step 5: Commit**

  ```bash
  git add src/topics.ts src/toolkit/topic.ts src/topic-content.ts src/topic-panel.ts src/map-description.ts src/map-page.ts src/layers.ts tests/
  git commit -m "Analyse topics and describe maps from layers"
  ```

### Task 9: Noms et scène sur les couches

**Files:**
- Modify: `src/toolkit/labels.ts:3,105-107` (`prepareLabels`), `src/toolkit/stage.ts:73-78` (`mountCanvasMap`), `src/styles/contract.ts` (`MountArgs`)
- Test: `tests/stage.test.ts`

**Interfaces:**
- Consumes: `featuresOf`, `isTunnel`, `Survey` (tâches 1, 7, 8) ; `MountArgs.layers` contient désormais les couches OSM (tâche 8).
- Produces :
  - `prepareLabels(layers: readonly Layer[]): Labels` (rues : `roads` sans tunnel ; canaux : `waterways` sans tunnel, mêmes poids et mêmes plafonds 90 / 40).
  - `mountCanvasMap({ container, layers, meta, shell, topic }, adapter)` : `half` vient de `meta.half`.
  - `MountMeta` garde ses champs ; `MountArgs.data` reste présent jusqu'à la tâche 13, mais la scène ne le lit plus.

**Risk:** normal

- [ ] **Step 1: Adapt the tests**

  `tests/stage.test.ts` passe `layers: osmLayers(data)` ; mêmes assertions (titre imprimé, nom de lieu absent, plateau).

- [ ] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/stage.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Migrate labels and stage**

- [ ] **Step 4: Run the tests and watch them pass**

  Run: `npm test && npm run typecheck`
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add src/toolkit/labels.ts src/toolkit/stage.ts src/styles/contract.ts tests/stage.test.ts
  git commit -m "Place map names from layers"
  ```

### Task 10: Riso sur les couches

**Files:**
- Modify: `src/styles/riso/plates.ts:48-66` (`Plates`, `preparePlates`), `src/styles/riso/index.ts`
- Test: `tests/rendering.test.ts`

**Interfaces:**
- Consumes: `featuresOf`, `isTunnel`, `MountArgs.layers` (tâches 1, 7, 9).
- Produces: `preparePlates(layers: readonly Layer[]): Plates`, même forme de `Plates` (les éléments gardent `r` / `p` internes, construits depuis `f.g`). Ruisseaux : `waterways` dont `k` n'est ni `canal` ni `river`, sans tunnel.

**Risk:** normal

- [ ] **Step 1: Write the regression test**

  Sur `public/data/amsterdam-centre.json`, la séquence d'appels de `renderPlateA` et `renderPlateB` (contexte enregistreur 320 × 640, vue `{ x: 0, y: 0, s: 0.5 }`) avec `preparePlates(osmLayers(data))` est égale à celle obtenue avec l'ancien `preparePlates(data)`. Écrire le test avant de changer la signature, en gardant l'ancienne fonction sous le nom `preparePlatesFromMapData` le temps de la tâche.

- [ ] **Step 2: Run the test and watch it fail**

  Run: `node --test tests/rendering.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Migrate riso, then delete `preparePlatesFromMapData` and the comparison, keeping a recorded-calls snapshot assertion on a small fixture**

- [ ] **Step 4: Run and check pixels**

  Run: `npm test && npm run typecheck`, puis serveur de dev et `npm run vignettes -- amsterdam-riso`.
  Expected: PASS ; `git status public/vignettes` vide. Si les octets diffèrent, comparer les images à l'œil et le signaler avant de continuer.

- [ ] **Step 5: Commit**

  ```bash
  git add src/styles/riso tests/rendering.test.ts
  git commit -m "Draw the riso style from layers"
  ```

### Task 11: Cyanotype sur les couches

**Files:**
- Modify: `src/styles/cyanotype/map.ts:35-63` (`PreparedMap`, `prepareMap`), `src/styles/cyanotype/index.ts:35`
- Test: `tests/rendering.test.ts`

**Interfaces:**
- Consumes: `featuresOf`, `isTunnel`, `MountArgs.layers`, `MountMeta.half` (tâches 1, 7, 9).
- Produces: `prepareMap(layers: readonly Layer[], half: number): PreparedMap`, même forme de `PreparedMap`. Ruisseaux : tous les `waterways` sans tunnel.

**Risk:** normal

- [ ] **Step 1: Write the regression test**

  Même méthode que la tâche 10 sur `public/data/lisbonne-alfama.json`, vue `{ x: 0, y: 0, s: 0.5 }`, plus le test existant du pont résidentiel réécrit en couche `roads` (`p: { bridge: true }`), avec la même assertion `lineTo(162, 320)`.

- [ ] **Step 2: Run the test and watch it fail**

  Run: `node --test tests/rendering.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Migrate cyanotype**

- [ ] **Step 4: Run and check pixels**

  Run: `npm test && npm run typecheck`, puis `npm run vignettes -- lisbonne-cyanotype`.
  Expected: PASS ; `git status public/vignettes` vide.

- [ ] **Step 5: Commit**

  ```bash
  git add src/styles/cyanotype tests/rendering.test.ts
  git commit -m "Draw the cyanotype style from layers"
  ```

### Task 12: Fichier OSM au format couche

**Files:**
- Modify: `scripts/fetch-osm.ts:84-95`, `places/index.ts:31-32` (`dataPath`), `src/catalogue.ts` (`problemsOf`, `PLACE_FIELDS`), `src/map-page.ts`
- Create (données) : `public/data/amsterdam-centre/osm.json`, `public/data/lisbonne-alfama/osm.json`
- Delete (données) : `public/data/amsterdam-centre.json`, `public/data/lisbonne-alfama.json`
- Test: `tests/catalogue.test.ts`, et tous les tests qui lisaient `public/data/<place>.json`

**Interfaces:**
- Consumes: `osmLayers` (tâche 7), `LayerFile`, `parseLayerFile` (tâche 1), `Survey` (tâche 8), `survey` (tâche 2).
- Produces :
  - `dataPath(id: PlaceId): string` → `` `data/${id}/osm.json` ``.
  - `fetch-osm` écrit `{ square: { lat, lon, sizeKm }, fetchedAt, server, osmTimestamp?, layers: osmLayers(convertOsm(...)) }`.
  - `problemsOf` vérifie `square` contre `places/index.ts` (champs `lat`, `lon`, `sizeKm` ; `name` et `district` ne sont plus contrôlés, ils viennent de `places/index.ts` et des traductions) et exige `fetchedAt` dans `osm.json`.
  - `map-page.ts` construit `Survey` depuis la place, `survey(place).half` et `fetchedAt` du fichier OSM ; `MountMeta` = `{ title, district, place, lat, lon, sizeKm, half, bbox, fetchedAt, attribution }`.

**Risk:** high (migre les données publiées)

- [ ] **Step 1: Write the failing tests**

  `tests/catalogue.test.ts` : `osm.json` dont `square.lat` diffère → `data for amsterdam-centre is out of date (<map id>): lat is 52.3712 in places/index.ts but 52.4 in the data; run npm run fetch-data -- amsterdam-centre` ; sans `fetchedAt` → `data/amsterdam-centre/osm.json has no fetchedAt (<map id>); run npm run fetch-data -- amsterdam-centre`.

- [ ] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/catalogue.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Convert the committed data without network**

  Script ponctuel dans le scratchpad (non versionné) : pour chaque place, lire `public/data/<place>.json` avec `parseMapData`, écrire `public/data/<place>/osm.json` = `{ square: { lat, lon, sizeKm } du meta, fetchedAt, server, osmTimestamp, layers: osmLayers(data) }`, puis supprimer l'ancien fichier. Mettre à jour les tests qui lisaient l'ancien chemin (`tests/rendering.test.ts`, `tests/topics.test.ts`, `tests/stage.test.ts`, `tests/descriptions.test.ts`) pour lire `osm.json` avec `parseLayerFile`.

- [ ] **Step 4: Run and verify**

  Run: `npm test && npm run typecheck && npm run build`, puis `npm run fetch-data -- amsterdam-centre --offline` si le cache `.cache/overpass/` existe (sinon le signaler) et `git diff --stat public/data` : aucune différence attendue. Vignettes des deux cartes régénérées : `git status public/vignettes` vide.

- [ ] **Step 5: Commit**

  ```bash
  git add scripts/fetch-osm.ts places/index.ts src/catalogue.ts src/map-page.ts public/data tests/
  git commit -m "Store OpenStreetMap data as a layer file"
  ```

### Task 13: Suppression de `MapData`

**Files:**
- Modify: `scripts/osm.ts` (`convertOsm` renvoie `Layer[]`), `scripts/fetch-osm.ts`, `src/styles/contract.ts` (retire `MountArgs.data`), `src/map-page.ts`, `src/toolkit/projection.ts:1` et tout import de `Line` / `Ring` / `BBox`
- Delete: `src/data.ts`, `src/osm-layers.ts`
- Modify (docs) : `src/styles/README.md` (section Données réécrite en couches et rôles), `.claude/skills/new-map/references/new-style.md:58`, `.claude/skills/new-map/SKILL.md:62,76`, `AGENTS.md`
- Test: `tests/osm.test.ts`, `tests/osm-layers.test.ts` (fusionné dans `tests/osm.test.ts`)

**Interfaces:**
- Consumes: tout ce que produisent les tâches 7 à 12.
- Produces :
  - `Line`, `Ring`, `BBox` et `RoadKind`, `ROAD_KINDS`, `isRoadKind` déplacés dans `src/layers.ts`.
  - `convertOsm(answer, placeId, source): Layer[]`, sortie égale à l'ancien `osmLayers(convertOsm(...))`.
  - `featureCounts(layers: readonly Layer[]): Record<string, number>` (dans `src/layers.ts`, mêmes libellés français).
  - `MountArgs` sans `data`.

**Risk:** high (supprime un type public utilisé par tous les styles)

- [ ] **Step 1: Rewrite `tests/osm.test.ts` at the new output**

  Mêmes cas et mêmes valeurs qu'aujourd'hui, lus par rôle : bâtiment en degrés projeté exactement, multipolygone assemblé avec son trou, `building:part` et `building=no` exclus, `Damrak` pont, `area=yes` exclu, footway tunnel, `bridge=no` / `tunnel=no` ignorés, `highway=proposed` exclu, `Singel`, culvert tunnel, `dam` et `riverbank` exclus des cours d'eau, `basin` / `riverbank` / `Vijver` dans `water`, parcs `garden` / `grass` / `wood` / `park`, mer reconstituée à l'ouest du littoral.

- [ ] **Step 2: Run the tests and watch them fail**

  Run: `node --test tests/osm.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Contract**

  Supprimer `src/data.ts` et `src/osm-layers.ts` ; aucun fichier ne doit plus importer `../data.ts` (`grep -rn "data.ts" src scripts tests` vide). Réécrire les docs listées.

- [ ] **Step 4: Verify the whole migration**

  Run: `npm test && npm run typecheck && npm run build`, puis `npm run fetch-data -- amsterdam-centre --offline` et `npm run fetch-data -- lisbonne-alfama --offline` si le cache existe : `git diff --stat public/data` vide. Vignettes des deux cartes régénérées : `git status public/vignettes` vide. Navigation clavier et description vérifiées dans le navigateur sur les deux cartes.

- [ ] **Step 5: Commit**

  ```bash
  git add -A src scripts tests places .claude AGENTS.md
  git commit -m "Remove the fixed OpenStreetMap data format"
  ```

## End of tasks

### Points ouverts

- Premières données extérieures réelles : sujet, source et licence à choisir avant d'en publier une.
- Sujets fondés sur des couches extérieures : à spécifier une fois la phase 2 livrée (`analyseTopic` lit déjà des couches).
- Import CSV et rasters géoréférencés : nouveaux convertisseurs dans `scripts/`, nouveau `kind` pour le raster.
- Taille des fichiers : les clés `g`, `k`, `n`, `p` alourdissent `osm.json` d'environ 10 à 20 % par rapport au format actuel ; mesurer à la tâche 12 et le signaler si l'écart dépasse 25 %.
