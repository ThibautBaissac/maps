# Cartes illustrées

Site statique de plans de quartiers dessinés en Canvas 2D, chacun dans un style graphique choisi en développement. Écrit en TypeScript 7 strict, construit avec Vite. Le visiteur parcourt la galerie, ouvre une carte, zoome avec les boutons, la molette ou le clavier et se déplace par glisser ou avec les flèches. Le bouton « Description » donne accès à la légende et aux voies nommées avec leur position approximative dans la zone.

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173/maps/. Version de production : `npm run build` puis `npm run preview`.

Node 24 ou plus récent : les scripts `.ts` tournent directement avec `node`, qui retire les types. `npm run typecheck` vérifie les types (`tsc -b`) ; `npm run build` le fait avant de construire.

## Organisation

```
places/index.ts           les lieux : nom, quartier, latitude, longitude, taille de la zone
public/data/<lieu>.json   ses données OpenStreetMap, téléchargées une fois
public/vignettes/<id>.webp  image de la carte dans la galerie (npm run vignettes)
src/registry.ts           la liste des cartes : un lieu × un style (+ options)
src/catalogue.ts          chaque carte résolue : titre, lieu, style, chemins ; lu par tout le site
src/styles/<style>/       un style : il dessine toute la page ; src/styles/index.ts les déclare
src/toolkit/              boîte à outils facultative : navigation, projection, noms, mise en page type…
src/map-page.ts, shell.ts page commune : charge les données et le style, lien retour, attribution
src/data.ts, place.ts     types des données et des lieux, partagés avec les scripts Node
src/gallery/              la page d'accueil : une bande verticale par carte
scripts/fetch-osm.ts      téléchargement des données d'un lieu
scripts/osm.ts            conversion d'une réponse Overpass en données de carte (pure, testée)
scripts/vignettes.ts      image de chaque carte pour la galerie (Chrome headless)
```

Au build, `vite.config.ts` lit le catalogue, vérifie que les données de chaque carte existent et correspondent encore à son lieu, puis génère une page par carte dans `cartes/<id>/` (dossier généré, ignoré par Git).

## Ajouter une carte

1. Ajouter le lieu à `places/index.ts` : `node .claude/skills/new-map/scripts/new-place.ts --city "<ville>" --district "<quartier>"`, ou à la main en copiant une entrée.
2. Télécharger ses données : `npm run fetch-data -- <lieu>`. À refaire après toute modification du lieu : le build refuse des données qui ne correspondent plus à leur lieu. La réponse Overpass brute est gardée dans `.cache/overpass/<lieu>.json` (ignoré par Git, une douzaine de Mo par lieu) : `npm run fetch-data -- <lieu> --offline` reconvertit cette réponse sans réseau, après un changement de la conversion (`scripts/osm.ts`) ou un simple renommage du lieu. Si le centre ou la taille du lieu a changé, il faut retélécharger.
3. Ajouter une ligne dans `src/registry.ts` :

   ```ts
   { id: 'lisbonne-riso', place: 'lisbonne-alfama', style: 'riso', options: { inkA: '#00A95C' } },
   ```

4. Prendre son image pour la galerie, serveur de développement lancé : `npm run vignettes -- <id>`. Le script ouvre la carte dans Chrome headless (variable `CHROME` si Chrome n'est pas trouvé) et écrit `public/vignettes/<id>.webp`, à commiter. Sans image, la bande de la galerie garde le papier du style ; le build le signale. À refaire quand le style ou les données changent.

Les options possibles d'un style sont dans son fichier `defaults.ts` ; le type-checking refuse une option inconnue ou un style inexistant. Pour créer un style, voir [`src/styles/README.md`](src/styles/README.md) : contrat, format des données, boîte à outils.

## Publier sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`. Dans le dépôt GitHub : Settings → Pages → Source : « GitHub Actions ». Le chemin de base (`/<nom-du-dépôt>/`) est fixé automatiquement ; en local il vaut `/maps/` (variable `BASE_PATH`).

## Données et licences

Données [© contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright), licence ODbL, téléchargées avec l'API Overpass (plusieurs serveurs publics essayés à la suite). Les pages ne contactent aucun serveur externe. Polices servies localement depuis `public/fonts/<famille>/`, chacune avec sa licence (SIL OFL).
