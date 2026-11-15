# Cartes illustrées

Site statique de plans de quartiers dessinés en Canvas 2D, chacun dans un style graphique choisi en développement. Le visiteur parcourt la galerie, ouvre une carte, zoome (molette) et se déplace (souris).

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173/maps/. Version de production : `npm run build` puis `npm run preview`.

## Organisation

```
places/<lieu>.js          un lieu : nom, quartier, latitude, longitude, taille de la zone
public/data/<lieu>.json   ses données OpenStreetMap, téléchargées une fois
src/registry.js           la liste des cartes : un lieu × un style (+ options)
src/styles/<style>/       un style : il dessine toute la page ; src/styles/index.js les déclare
src/toolkit/              boîte à outils facultative : navigation, projection, noms, mise en page type…
src/map-page.js, shell.js page commune : charge les données et le style, lien retour, attribution
src/gallery/              la page d'accueil
```

Au build, `vite.config.js` lit le registre, vérifie chaque entrée et génère une page par carte dans `cartes/<id>/` (dossier généré, ignoré par Git).

## Ajouter une carte

1. Créer `places/<lieu>.js` (copier `places/amsterdam-centre.js`).
2. Télécharger ses données : `npm run fetch-data -- <lieu>`.
3. Ajouter une ligne dans `src/registry.js` :

   ```js
   { id: 'lisbonne-riso', place: 'lisbonne-alfama', style: 'riso', options: { inkA: '#00A95C' } },
   ```

Les options possibles d'un style sont dans son fichier `defaults.js`. Pour créer un style, voir [`src/styles/README.md`](src/styles/README.md) : contrat, format des données, boîte à outils.

## Publier sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`. Dans le dépôt GitHub : Settings → Pages → Source : « GitHub Actions ». Le chemin de base (`/<nom-du-dépôt>/`) est fixé automatiquement ; en local il vaut `/maps/` (variable `BASE_PATH`).

## Données et licences

Données [© contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright), licence ODbL, téléchargées avec l'API Overpass (plusieurs serveurs publics essayés à la suite). Les pages ne contactent aucun serveur externe. Police [Bebas Neue](https://github.com/dharmatype/Bebas-Neue) servie localement (SIL OFL, voir `public/fonts/OFL.txt`).
