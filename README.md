# Cartes illustrées

Site statique de plans de quartiers dessinés en Canvas 2D, chacun dans un style graphique choisi en développement. Écrit en TypeScript 7 strict, construit avec Vite. Le visiteur parcourt la galerie, ouvre une carte, zoome (molette) et se déplace (souris).

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173/maps/. Version de production : `npm run build` puis `npm run preview`.

Node 24 ou plus récent : les scripts `.ts` tournent directement avec `node`, qui retire les types. `npm run typecheck` vérifie les types (`tsc -b`) ; `npm run build` le fait avant de construire.

## Organisation

```
places/<lieu>.ts          un lieu : nom, quartier, latitude, longitude, taille de la zone
public/data/<lieu>.json   ses données OpenStreetMap, téléchargées une fois
src/registry.ts           la liste des cartes : un lieu × un style (+ options)
src/styles/<style>/       un style : il dessine toute la page ; src/styles/index.ts les déclare
src/toolkit/              boîte à outils facultative : navigation, projection, noms, mise en page type…
src/map-page.ts, shell.ts page commune : charge les données et le style, lien retour, attribution
src/data.ts, place.ts     types des données et des lieux, partagés avec les scripts Node
src/gallery/              la page d'accueil
scripts/fetch-osm.ts      téléchargement des données d'un lieu
```

Au build, `vite.config.ts` lit le registre, vérifie chaque entrée et génère une page par carte dans `cartes/<id>/` (dossier généré, ignoré par Git).

## Ajouter une carte

1. Créer `places/<lieu>.ts` (copier `places/amsterdam-centre.ts`).
2. Télécharger ses données : `npm run fetch-data -- <lieu>`.
3. Ajouter une ligne dans `src/registry.ts` :

   ```ts
   { id: 'lisbonne-riso', place: 'lisbonne-alfama', style: 'riso', options: { inkA: '#00A95C' } },
   ```

Les options possibles d'un style sont dans son fichier `defaults.ts` ; le type-checking refuse une option inconnue ou un style inexistant. Pour créer un style, voir [`src/styles/README.md`](src/styles/README.md) : contrat, format des données, boîte à outils.

## Publier sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`. Dans le dépôt GitHub : Settings → Pages → Source : « GitHub Actions ». Le chemin de base (`/<nom-du-dépôt>/`) est fixé automatiquement ; en local il vaut `/maps/` (variable `BASE_PATH`).

## Données et licences

Données [© contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright), licence ODbL, téléchargées avec l'API Overpass (plusieurs serveurs publics essayés à la suite). Les pages ne contactent aucun serveur externe. Polices servies localement depuis `public/fonts/<famille>/`, chacune avec sa licence (SIL OFL).
