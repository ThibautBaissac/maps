# Cartes illustrées

Site statique de plans de quartiers dessinés en Canvas 2D, chacun dans un style graphique choisi en développement. Écrit en TypeScript 7 strict, construit avec Vite. Le visiteur choisit le français, l’anglais ou l’espagnol, parcourt la galerie, ouvre une carte, zoome avec les boutons, la molette ou le clavier et se déplace par glisser ou avec les flèches. Le bouton « Description » donne accès à la légende et aux voies nommées avec leur position approximative dans la zone.

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
public/vignettes/<langue>/<id>.webp  image traduite de la carte dans la galerie
src/registry.ts           la liste des cartes : un lieu × un style (+ options)
src/catalogue.ts          chaque carte résolue par langue : titre, lieu, style, chemins
src/i18n/                 dictionnaires typés, formats et contrôle des traductions
src/styles/<style>/       un style : il dessine toute la page ; src/styles/index.ts les déclare
src/toolkit/              boîte à outils facultative : navigation, projection, noms, mise en page type…
src/map-page.ts, shell.ts page commune : charge les données et le style, lien retour, attribution
src/data.ts, place.ts     types des données et des lieux, partagés avec les scripts Node
src/gallery/              la page d'accueil : une bande verticale par carte
scripts/fetch-osm.ts      téléchargement des données d'un lieu
scripts/osm.ts            conversion d'une réponse Overpass en données de carte (pure, testée)
scripts/vignettes.ts      image de chaque carte pour la galerie (Chrome headless)
scripts/pages.ts          HTML traduit des galeries et des cartes
```

Au build, `vite.config.ts` vérifie les traductions et les données, puis génère une galerie par langue et une page par carte dans `<langue>/cartes/<id>/`. La racine et les anciennes adresses `cartes/<id>/` restent accessibles en français pour préserver les liens existants.

## Ajouter une carte

1. Ajouter le lieu à `places/index.ts` : `node .claude/skills/new-map/scripts/new-place.ts --city "<ville>" --district "<quartier>"`, ou à la main en copiant une entrée. Ajouter son nom et son quartier dans `places` de chaque dictionnaire `src/i18n/`.
2. Télécharger ses données : `npm run fetch-data -- <lieu>`. À refaire après toute modification du lieu : le build refuse des données qui ne correspondent plus à leur lieu. La réponse Overpass brute est gardée dans `.cache/overpass/<lieu>.json` (ignoré par Git, une douzaine de Mo par lieu) : `npm run fetch-data -- <lieu> --offline` reconvertit cette réponse sans réseau, après un changement de la conversion (`scripts/osm.ts`) ou un simple renommage du lieu. Si le centre ou la taille du lieu a changé, il faut retélécharger.
3. Ajouter une ligne dans `src/registry.ts` :

   ```ts
   { id: 'lisbonne-riso', place: 'lisbonne-alfama', style: 'riso', options: { inkA: '#00A95C' } },
   ```

4. Prendre ses images pour la galerie, serveur de développement lancé : `npm run vignettes -- <id>`. Le script ouvre chaque version dans Chrome headless (variable `CHROME` si Chrome n'est pas trouvé) et écrit `public/vignettes/<langue>/<id>.webp`, à commiter. `--locale es` limite la capture à une langue. Sans image, la bande de la galerie garde le papier du style ; le build le signale. À refaire quand le style, ses textes ou les données changent.

Les options possibles d'un style sont dans son fichier `defaults.ts` ; le type-checking refuse une option inconnue ou un style inexistant. Pour créer un style, voir [`src/styles/README.md`](src/styles/README.md) : contrat, format des données, boîte à outils.

## Traductions

Les dictionnaires de [`src/i18n/`](src/i18n/) fournissent les textes du HTML, des descriptions accessibles et des dessins Canvas. Le catalogue combine leurs noms de villes et de quartiers avec les données géographiques communes. Traduire un nom dans ces dictionnaires ne modifie ni l’identifiant du lieu ni le fichier OSM ; aucun téléchargement supplémentaire n’est nécessaire. Les rues et cours d’eau gardent leurs noms locaux.

Le champ `title` du registre accepte un nom commun aux langues ou un objet `{ fr: '…', en: '…', es: '…' }`. Les pages d’une même carte partagent son identifiant. Changer de langue ouvre la même carte et réinitialise sa vue.

Pour ajouter une langue, compléter [`src/i18n/types.ts`](src/i18n/types.ts) et enregistrer son dictionnaire dans [`src/i18n/index.ts`](src/i18n/index.ts), y compris son format régional. Ajouter son dossier HTML généré à `.gitignore`, puis générer ses vignettes. Le contrôle TypeScript exige les messages, lieux et styles ; le contrôle de construction refuse aussi les textes vides. Les écritures de droite à gauche nécessitent une adaptation du placement des noms dans le Canvas.

## Publier sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`. Dans le dépôt GitHub : Settings → Pages → Source : « GitHub Actions ». Le chemin de base (`/<nom-du-dépôt>/`) est fixé automatiquement ; en local il vaut `/maps/` (variable `BASE_PATH`).

La construction sur GitHub Actions déduit l’adresse publique du dépôt pour les liens canoniques et `hreflang`. Pour un domaine personnalisé, fournir `SITE_URL` avec l’adresse complète du site, chemin inclus, par exemple `https://exemple.fr/maps/`. La prévisualisation locale omet ces liens tant qu’aucune adresse publique ne figure dans la configuration de [`vite.config.ts`](vite.config.ts).

## Données et licences

Données [© contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright), licence ODbL, téléchargées avec l'API Overpass (plusieurs serveurs publics essayés à la suite). Les pages ne contactent aucun serveur externe. Polices servies localement depuis `public/fonts/<famille>/`, chacune avec sa licence (SIL OFL).
