# Cartes illustrées

Site statique de cartes qui expliquent une particularité d’un lieu : franchissements des canaux à Amsterdam, répartition des escaliers autour d’Alfama. Chaque carte conserve son style graphique en Canvas 2D. Le visiteur lit le sujet, consulte les mesures et leur méthode, retrouve les repères numérotés, zoome et déplace le plan. Le bouton « Description » fournit le contenu textuel, la légende et les voies nommées. Le site propose le français, l’anglais et l’espagnol. Écrit en TypeScript 7 strict, construit avec Vite.

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
public/data/<lieu>/osm.json  ses couches OpenStreetMap, téléchargées une fois
public/vignettes/<langue>/<id>.webp  image traduite de la carte dans la galerie
public/vignettes/<langue>/<id>.jpg   image 1200×630 d'un lien partagé (Open Graph)
src/registry.ts           la liste des cartes : un lieu × un style (+ options)
src/catalogue.ts          chaque carte résolue par langue : titre, lieu, style, chemins
src/i18n/                 dictionnaires typés, formats et contrôle des traductions
src/i18n/maps/<id>.ts     question et intro d'une carte, dans sa voix, en cinq langues
src/entries/<langue>.ts   entrée des pages de carte : le dictionnaire de la langue, puis la page
src/topics/<sujet>/       analyse, texte du panneau et traductions de chaque sujet
src/styles/<style>/       un style : il dessine toute la page ; src/styles/index.ts les déclare
src/toolkit/              boîte à outils facultative : navigation, projection, noms, mise en page type…
src/map-page.ts, shell.ts page commune : charge les données et le style, lien retour, attribution
src/layers.ts, place.ts   types des couches et des lieux, partagés avec les scripts Node
src/gallery/              la page d'accueil : une bande verticale par carte
scripts/fetch-osm.ts      téléchargement des données d'un lieu
scripts/osm.ts            conversion d'une réponse Overpass en couches de carte (pure, testée)
scripts/vignettes.ts      images de chaque carte, galerie et partage (Chrome headless)
scripts/pages.ts          HTML traduit des galeries et des cartes
```

Au build, `vite.config.ts` vérifie les traductions et les données, puis génère une galerie par langue et une page par carte dans `<langue>/cartes/<id>/`. La racine et les anciennes adresses `cartes/<id>/` restent accessibles en français pour préserver les liens existants.

## Ajouter une carte

Avant de réaliser la carte, l’agent examine les données, recommande un sujet et attend sa validation explicite. La [compétence de création](.claude/skills/new-map/SKILL.md) décrit ce fonctionnement. Le sujet indique ce que le lecteur pourra comprendre du lieu ; les données déterminent les observations et leurs limites.

1. Ajouter le lieu à `places/index.ts` : `node .claude/skills/new-map/scripts/new-place.ts --city "<ville>" --district "<quartier>"`, ou à la main en copiant une entrée. Ajouter son nom et son quartier dans `places` de chaque dictionnaire `src/i18n/`.
2. Télécharger ses données : `npm run fetch-data -- <lieu>`. À refaire après toute modification du lieu : le build refuse des données qui ne correspondent plus à leur lieu. La réponse Overpass brute est gardée dans `.cache/overpass/<lieu>.json` (ignoré par Git, une douzaine de Mo par lieu) : `npm run fetch-data -- <lieu> --offline` reconvertit cette réponse sans réseau, après un changement de la conversion (`scripts/osm.ts`) ou un simple renommage du lieu. Si le centre ou la taille du lieu a changé, il faut retélécharger.
3. Ajouter une ligne dans `src/registry.ts` :

   ```ts
   { id: 'lisbonne-riso', place: 'lisbonne-alfama', style: 'riso', topic: 'steps', options: { inkA: '#00A95C' } },
   ```

4. Prendre ses images pour la galerie, serveur de développement lancé : `npm run vignettes -- <id>`. Le script ouvre chaque version dans Chrome headless (variable `CHROME` si Chrome n'est pas trouvé) et écrit `public/vignettes/<langue>/<id>.webp` (galerie) et `<id>.jpg` (aperçu d'un lien partagé), à commiter. `--locale es` limite la capture à une langue, `--missing` aux versions sans images, `--jobs 2` le nombre de Chrome lancés à la fois (4 au plus par défaut). Le build refuse une carte publiée sans ses deux images, dans chaque langue. À refaire quand le style, ses textes ou les données changent.

Les options possibles d'un style sont dans son fichier `defaults.ts` ; le type-checking refuse une option inconnue ou un style inexistant. Pour créer un style, voir [`src/styles/README.md`](src/styles/README.md) : contrat, format des données, boîte à outils.

Chaque sujet vit dans `src/topics/<id>/` et s’enregistre dans [le registre des sujets](src/topics/index.ts), avec ses thèmes et l’import de son module : une page de carte ne charge que le code et les textes de son sujet. [`src/topics/all.ts`](src/topics/all.ts) les charge tous pour Node et les tests. L’[analyse des sujets linéaires](src/topics/linear/index.ts) sélectionne les géométries, les découpe au carré du relevé et calcule leurs longueurs et leur répartition. Le dessin et le texte partagent ce résultat ; ils ne recalculent pas les mesures selon le zoom. Les longueurs décrivent les tronçons OSM et peuvent inclure des voies parallèles. Elles ne donnent ni un nombre de ponts physiques, ni un nombre de marches, ni un dénivelé. Les secteurs divisent le carré du relevé ; ils ne désignent pas des quartiers administratifs.

## Traductions

Les dictionnaires de [`src/i18n/`](src/i18n/) fournissent les textes du HTML, des descriptions accessibles et des dessins Canvas. Le catalogue combine leurs noms de villes et de quartiers avec les données géographiques communes. Traduire un nom dans ces dictionnaires ne modifie ni l’identifiant du lieu ni le fichier OSM ; aucun téléchargement supplémentaire n’est nécessaire. Les rues et cours d’eau gardent leurs noms locaux.

Le champ `title` du registre accepte un nom commun aux langues ou un objet `{ fr: '…', en: '…', es: '…', pt: '…', de: '…' }`. Les pages d’une même carte partagent son identifiant. Changer de langue ouvre la même carte et réinitialise sa vue.

Pour ajouter une langue, compléter [`src/i18n/types.ts`](src/i18n/types.ts), écrire son dictionnaire `src/i18n/<langue>.ts` (qui s’enregistre avec `addMessages`), l’importer dans [`src/i18n/all.ts`](src/i18n/all.ts), créer l’entrée de ses pages de carte `src/entries/<langue>.ts`, et ajouter son format régional dans [`src/i18n/index.ts`](src/i18n/index.ts). Une page de carte ne charge que le dictionnaire de sa langue. Ajouter la langue à chaque histoire de [`src/i18n/maps/`](src/i18n/maps/). Ajouter son dossier HTML généré à `.gitignore`, puis générer ses vignettes. Ajouter aussi la langue au `messages.ts` de chaque sujet de [`src/topics/`](src/topics/). Le contrôle TypeScript exige les messages, lieux, styles et sujets ; le contrôle de construction refuse aussi les textes vides. Les écritures de droite à gauche nécessitent une adaptation du placement des noms dans le Canvas.

## Publier sur GitHub Pages

Le workflow `.github/workflows/deploy.yml` construit et publie le site à chaque push sur `main`. Dans le dépôt GitHub : Settings → Pages → Source : « GitHub Actions ». Le chemin de base (`/<nom-du-dépôt>/`) est fixé automatiquement ; en local il vaut `/maps/` (variable `BASE_PATH`).

La construction sur GitHub Actions déduit l’adresse publique du dépôt pour les liens canoniques, `hreflang`, les balises Open Graph et `sitemap.xml`. GitHub Pages ne lit pas de `robots.txt` sous `/maps/` : soumettre `sitemap.xml` dans Google Search Console. Pour un domaine personnalisé, fournir `SITE_URL` avec l’adresse complète du site, chemin inclus, par exemple `https://exemple.fr/maps/`. La prévisualisation locale omet ces liens et le sitemap tant qu’aucune adresse publique ne figure dans la configuration de [`vite.config.ts`](vite.config.ts).

## Données et licences

Données [© contributeurs OpenStreetMap](https://www.openstreetmap.org/copyright), licence ODbL, téléchargées avec l'API Overpass (plusieurs serveurs publics essayés à la suite). Les pages ne contactent aucun serveur externe. Polices servies localement depuis `public/fonts/<famille>/`, chacune avec sa licence (SIL OFL).
