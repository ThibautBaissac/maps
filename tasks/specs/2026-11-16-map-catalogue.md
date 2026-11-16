# Catalogue de cartes : chaque entrée du registre résolue une seule fois

## Problem statement

Une carte, c'est un lieu dessiné dans un style. Aujourd'hui, ce qu'il faut savoir d'une carte (son titre, l'identité de son lieu, son style, ses chemins) est recalculé par chaque appelant, à partir de sources différentes :

- **Le titre affiché est calculé 3 fois, à partir de 2 sources.**
  - La génération des pages (config Vite, pour le `<title>`) et la galerie lisent le fichier du lieu.
  - La page de carte lit le `meta` des données téléchargées, une copie du lieu figée au moment du téléchargement.
  - Si on modifie un lieu sans retélécharger ses données, l'onglet et la galerie affichent la nouvelle version, la carte et sa description l'ancienne.
- **Les lieux sont chargés de 3 façons :**
  - import dynamique + vérification, dans la config Vite et le script de téléchargement ;
  - `import.meta.glob` sans vérification, dans la galerie ;
  - `meta` des données, dans la page de carte.
- **Les chemins sont écrits à la main à plusieurs endroits :** la page (`cartes/<id>/`), les données (`data/<lieu>.json`) et la vignette (`vignettes/<id>.webp`).
- **La galerie formate les coordonnées avec son propre code**, différent des cartouches.
- **Les styles reçoivent un `meta` qui contient à la fois `title` et `name`.** Imprimer `name` au lieu de `title` est un bug déjà corrigé une fois, et rien n'empêche de le refaire.
- **La résolution réelle du titre n'est pas testée.**

## Solution

Un module catalogue, pur, utilisable dans le navigateur et sous Node, transforme chaque entrée du registre en carte résolue. Une carte résolue porte :
- son id et son titre ;
- son lieu et l'id de ce lieu ;
- son style, avec sa définition et ses options ;
- ses chemins relatifs (page, données, vignette).

La génération des pages, la galerie, la page de carte et le script des vignettes consomment ce catalogue.

Les lieux vivent dans un seul index statique typé. L'id du lieu dans une entrée du registre est alors vérifié par le typecheck, et plus aucun lieu n'est chargé dynamiquement.

Au build, le catalogue compare chaque lieu aux données téléchargées. Des données périmées arrêtent le build ; en développement, la carte est ignorée avec un avertissement.

Le `meta` passé aux styles ne contient plus `name`.

## User stories

1. En tant que visiteur, je veux que le titre de l'onglet, la bande de la galerie, le cartouche et la description d'une carte affichent le même titre, pour ne pas voir deux noms pour la même carte.
2. En tant que visiteur, je veux que les coordonnées de la galerie s'écrivent comme dans les cartouches (`52.37°N 4.89°E`, avec « O » pour l'ouest), pour une présentation cohérente.
3. En tant que mainteneur, je veux qu'un lieu modifié sans retéléchargement de ses données arrête `npm run build`, avec un message qui nomme la carte, le champ, les deux valeurs et la commande à lancer, pour que le site ne publie jamais une carte en désaccord avec son lieu.
4. En tant que mainteneur, je veux qu'en développement la même incohérence ignore la carte avec un avertissement dans la console du serveur, comme les autres problèmes du registre, pour que les autres cartes continuent de marcher.
5. En tant que mainteneur, je veux qu'une entrée du registre qui cite un lieu inconnu soit une erreur de typecheck, pour la voir avant même le build.
6. En tant que mainteneur, je veux qu'une entrée dont les données manquent arrête le build avec la commande `npm run fetch-data -- <lieu>` dans le message, et l'ignore en développement.
7. En tant que mainteneur, je veux qu'un id de carte invalide ou en double arrête le build, et soit ignoré avec un avertissement en développement.
8. En tant que mainteneur, je veux que les chemins de page, de données et de vignette d'une carte soient définis à un seul endroit, pour pouvoir les changer sans chercher tous les appelants.
9. En tant qu'auteur d'un style, je veux que le `meta` reçu par `mount` n'ait pas de `name`, pour qu'imprimer le nom du lieu au lieu du titre soit une erreur de compilation.
10. En tant qu'auteur d'un style, je veux que `meta` garde `title`, `district`, `lat`, `lon` et les autres champs de géométrie des données.
11. En tant qu'agent qui exécute `/new-map`, je veux que le script de création de lieu ajoute le lieu à l'index en une commande, et refuse un id déjà pris, pour ne rien éditer à la main.
12. En tant qu'agent qui exécute `/new-map`, je veux que le script de téléchargement lise le lieu dans l'index et, pour un id inconnu, liste les ids connus.
13. En tant qu'agent qui exécute `/new-map`, je veux que le skill, le README et les commentaires décrivent l'index des lieux et non plus un fichier par lieu.
14. En tant que mainteneur, je veux que la résolution du titre, les chemins, la recherche par id et les contrôles du registre soient testés sans navigateur ni Vite.

## Implementation decisions

### Index des lieux

Un seul module de données, `places/index.ts`, remplace les fichiers par lieu :
- Il exporte `PLACES`, un objet littéral dont les clés sont les ids de lieu (ceux des fichiers de données) et les valeurs des `Place`. Il est déclaré `as const satisfies Record<string, Place>`.
- Il exporte aussi le type `PlaceId`, qui vaut `keyof typeof PLACES`.
- Chaque entrée garde en commentaire, au-dessus d'elle, sa provenance (« Located from: … ») et la commande de téléchargement.
- Les deux lieux existants y sont repris à l'identique.

Le module du type `Place` garde son type et ses helpers (`isRecord`, `isSlug`, `formatLat`, `formatLon`, `parsePlace`).

### Registre

- `MapEntryOf.place` devient `PlaceId`.
- Le registre ne fait que lister des entrées. Ses commentaires renvoient au catalogue pour la résolution.

### Module catalogue

Forme retenue pendant la conception :

```ts
interface CatalogueMapOf<K extends StyleKey> {
  id: string;
  title: string;                     // entry.title ?? place.name
  placeId: PlaceId;
  place: Place;
  style: K;
  styleDef: StyleDef<StyleOptions[K]>;
  options: Partial<StyleOptions[K]>; // {} quand l'entrée n'en a pas
  paths: { page: string; data: string; vignette: string };
}
type CatalogueMap = { [K in StyleKey]: CatalogueMapOf<K> }[StyleKey];

const CATALOGUE: readonly CatalogueMap[];
function findMap(id: string): CatalogueMap | undefined;
const dataPath: (placeId: PlaceId) => string;
function catalogueProblems(readData: (path: string) => unknown): { id: string; message: string }[];
```

- **Chemins**, relatifs à la racine du site, sans `/` initial :
  - page : `cartes/<id>/` ;
  - données : `data/<placeId>.json` (c'est `dataPath`) ;
  - vignette : `vignettes/<id>.webp`.

  Côté navigateur, l'appelant les préfixe avec `BASE_URL`. Côté Node, il les résout sous `public/` pour les données et les vignettes, et sous la racine du projet pour les pages.
- **`catalogueProblems(readData)`** contrôle chaque entrée du registre, dans cet ordre, et ne retient que le premier problème de chaque entrée :
  1. id qui n'est pas un slug, ou déjà vu ;
  2. `readData(paths.data)` renvoie `undefined` : données absentes, et le message donne `npm run fetch-data -- <placeId>` ;
  3. le `meta` des données n'est pas un objet, ou l'un des champs `name`, `district`, `lat`, `lon`, `sizeKm` n'y vaut pas (au sens de `===`) celui du lieu : données périmées. Le message nomme le champ, la valeur du lieu, celle des données, et la commande de téléchargement.
- **Seams internes de test :** le module exporte aussi `catalogueOf(maps)` et `problemsOf(maps, readData)`, qui font le même travail pour un registre quelconque. `CATALOGUE` vaut `catalogueOf(MAPS)`, et `catalogueProblems` appelle `problemsOf` avec `MAPS`. Les deux sont documentés comme réservés aux tests.
- Le catalogue n'accède ni au DOM, ni à une API Node, ni à `import.meta.env`.

### Génération des pages (config Vite)

- **Contrôle du registre :** elle appelle `catalogueProblems` avec un `readData` qui lit et parse `public/<path>`, et renvoie `undefined` si le fichier n'existe pas. Chaque problème arrête le build (mode strict) ou, en développement, ignore la carte avec l'avertissement `[registry] skipped: <message>`.
- **Écriture des pages :** une page par carte du catalogue sans problème. Elle prend son titre dans `title`, son quartier dans `place.district`, le libellé du style dans `styleDef.label` et son dossier dans `paths.page`.
- **Vignette :** l'avertissement « pas de vignette » est inchangé, mais il teste `public/<paths.vignette>`.
- **Ce qui disparaît :** l'import dynamique des lieux, `parsePlace` et le test d'existence du fichier de lieu.
- Le plugin de surveillance ne surveille plus que le dossier des données. L'index des lieux est une dépendance de la config, et Vite redémarre déjà quand il change.

### Galerie

- Elle parcourt `CATALOGUE`, sans `import.meta.glob`.
- Le lien, l'image et les couleurs viennent de la carte résolue : `paths.page`, `BASE_URL + paths.vignette`, `styleDef.card(options)`.
- Les coordonnées s'écrivent `formatLat(lat, 2)`, une espace, puis `formatLon(lon, 2, 'O')`. Le format local `fmt` disparaît.

### Page de carte

- Elle trouve sa carte avec `findMap(id)`. Un id inconnu garde l'erreur actuelle.
- Elle charge `BASE_URL + paths.data`.
- La description et `mount` reçoivent le titre du catalogue.
- `meta` vaut le `meta` des données privé de `name`, plus `title`.

### Contrat de style

- `MountArgs.meta` devient `Omit<MapMeta, 'name'> & { title: string }`. Ce type est nommé dans le contrat (`MountMeta`) et utilisé par le cartouche riso et le cartouche cyanotype.
- Le commentaire du champ dit que le titre vient du catalogue.

### Script de téléchargement

- Il lit le lieu dans `PLACES`. Un argument qui n'est pas une clé de `PLACES` donne l'erreur `No such place: <id>. Known: <ids séparés par des virgules>`.
- Il écrit les données dans `public/` + `dataPath(id)`.
- L'import dynamique et `parsePlace` disparaissent de ce script.

### Script de création de lieu (skill `/new-map`)

- Il refuse un id déjà présent dans `PLACES`.
- Il construit l'entrée : le commentaire de provenance et de commande, puis la clé et l'objet. Il la valide avec `parsePlace` avant d'écrire.
- Il l'insère dans l'index juste avant la ligne qui ferme l'objet (`} as const satisfies Record<string, Place>;`). Si cette ligne est introuvable, il échoue avec un message, sans rien écrire.
- `--dry-run` affiche l'entrée sans rien écrire.

### Documentation

- **README :** arborescence, et procédure « ajouter un lieu ».
- **Skill `/new-map` :** l'introduction, l'étape 1 (réutiliser un lieu présent dans l'index, sinon lancer le script) et l'étape 3 (le typecheck vérifie le lieu ; le build vérifie les données et leur cohérence avec le lieu).
- **Commentaires d'en-tête** du module `Place`, du registre et du format des données.

## Testing decisions

- **Seam :** l'interface du module catalogue (`CATALOGUE`, `findMap`, `catalogueProblems`), plus les seams internes `catalogueOf` et `problemsOf` pour les registres de test. Niveau in-process : aucun DOM, aucun Vite, aucun fichier lu en dehors du fixture.
- **Tests (`tests/catalogue.test.ts`) :**
  1. Une entrée sans `title` a pour titre le nom de son lieu. Une entrée avec `title` garde ce titre. On le teste avec `catalogueOf` sur un registre de test.
  2. Les chemins d'une carte valent `cartes/<id>/`, `data/<placeId>.json` et `vignettes/<id>.webp`.
  3. `findMap` renvoie la carte d'un id connu et `undefined` pour un id inconnu.
  4. `catalogueProblems` avec les vraies données du dépôt (lues sous `public/`) ne renvoie aucun problème.
  5. Des données absentes donnent un problème dont le message contient `npm run fetch-data -- <placeId>`.
  6. Des données dont le `district` diffère du lieu donnent un problème qui nomme `district` et les deux valeurs.
  7. Un id invalide et un id en double donnent chacun un problème.
- **Ce qui suit le nouveau type :** le test de mount (`stage.test.ts`) construit `meta` sans `name`.
- **Ce qu'un bon test vérifie ici :** les valeurs résolues et les problèmes renvoyés, jamais la structure interne.
- **Prior art :** `tests/coastline.test.ts` (fonction pure, valeurs construites à la main) et `tests/stage.test.ts` (fixture Amsterdam).

## Global constraints

- Node ≥ 24 ; `node --test` sur les `.ts`, sans dépendance ajoutée.
- TypeScript strict, `noUncheckedIndexedAccess` : `npm run typecheck` passe sans erreur.
- `npm test` et `npm run build` passent.
- Le catalogue et l'index des lieux tournent dans le navigateur et sous Node : ni DOM, ni API Node, ni `import.meta.env`.
- Ids de carte et de lieu : `[a-z0-9-]+`.
- Chemins relatifs sans `/` initial : `cartes/<id>/`, `data/<placeId>.json`, `vignettes/<id>.webp`.
- Format des coordonnées dans la galerie : `formatLat(v, 2)` + espace + `formatLon(v, 2, 'O')`.
- Le rendu des deux cartes est inchangé. Les seuls changements visibles sont dans la galerie : le format des coordonnées.
- Langue : français pour la doc et les messages destinés aux visiteurs, anglais pour le code, les commentaires et les messages d'erreur des scripts, comme aujourd'hui.

## Out of scope

- Masquer dans la galerie, en développement, une carte ignorée par la génération des pages.
- Un module virtuel Vite publiant le catalogue résolu au build.
- Un type d'identité restreint (`title`, `district`, `lat`, `lon`) à la place de `Omit<MapMeta, 'name'>`.
- Retélécharger des données, ou changer leur format.
- Déplacer les définitions de style dans leur dossier (candidat 5 de la revue d'architecture).

## Further notes

- Ce spec vient du candidat 2 de la revue d'architecture du 15/11/2026.
- Vérifié pendant la conception : les deux lieux existants sont identiques au `meta` de leurs données (`name`, `district`, `lat`, `lon`, `sizeKm`). Le nouveau contrôle ne casse donc pas le build actuel.
- Vérification manuelle prévue :
  - typecheck, tests et build ;
  - au navigateur, la galerie (titres, coordonnées) et les deux pages (`<title>`, cartouche, description) ;
  - un `district` modifié temporairement dans l'index doit faire échouer `npm run build` avec le message attendu, puis être rétabli.
