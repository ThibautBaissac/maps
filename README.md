# Plan risographie

Plan illustré d'un quartier, dessiné en Canvas 2D dans le style d'une impression risographie à deux encres (rose fluo et bleu, fusion multiplicative, léger décalage entre les plaques). Zoom à la molette, déplacement à la souris.

## Lancer

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5173. Version statique : `npm run build` (sortie dans `dist/`).

## Changer de ville

Modifier la variable `CITY` dans [`city.config.js`](city.config.js) (nom, quartier, latitude, longitude, taille de la zone), puis télécharger les nouvelles données :

```bash
npm run fetch-data
```

## Données

Les données viennent d'[OpenStreetMap](https://www.openstreetmap.org/copyright) (© contributeurs OpenStreetMap, licence ODbL). Le script `scripts/fetch-osm.mjs` les télécharge une seule fois avec l'API Overpass (plusieurs serveurs publics essayés à la suite), les projette en mètres et les enregistre dans `data/quartier.json`. La page ne contacte aucun serveur au chargement.

La police [Bebas Neue](https://github.com/dharmatype/Bebas-Neue) est servie localement depuis `public/fonts/` (licence SIL OFL, voir `OFL.txt`).
