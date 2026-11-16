# Conversion OSM → MapData : un module pur, testable

## Problem statement

Le script de téléchargement transforme une réponse Overpass en fichier de données de carte. C'est le code de données le plus risqué du projet, et il n'a pas d'interface :

- importer le script lit la ligne de commande, appelle le réseau et écrit le fichier ;
- rien de la conversion n'est testable (projection, arrondi, assemblage des anneaux des relations, règles de classement, construction du `meta`) ;
- seul le calcul de la mer à partir du littoral est testé, sur des anneaux faits main, jamais sur des coordonnées projetées et arrondies comme dans l'appel réel.

Par ailleurs, la doc du format des données dit qu'un anneau ne répète pas son premier point. C'est faux : tous les anneaux téléchargés le répètent.

## Solution

Un module pur fait toute la conversion, sans réseau ni système de fichiers. Il a trois fonctions : la requête Overpass d'un lieu, la validation d'une réponse, et la conversion d'une réponse en `MapData`.

Le script de téléchargement garde la ligne de commande, le téléchargement (serveurs, tours, pause), l'écriture et le récapitulatif.

La conversion est testée de bout en bout sur une réponse Overpass écrite à la main.

La doc des anneaux est corrigée.

Le comportement ne change pas : pour une même réponse Overpass, l'ancien et le nouveau script écrivent le même fichier, à la date de téléchargement près.

## User stories

1. En tant que mainteneur, je veux tester la conversion d'une réponse Overpass sans réseau ni fichier, pour modifier une règle de classement sans tout retélécharger.
2. En tant que mainteneur, je veux un test pour chaque règle de classement (bâtiment, `building:part` ignoré, route, route-surface ignorée, pont, tunnel, cours d'eau, eau, parc, côte), pour qu'une régression soit nommée par le test qui tombe.
3. En tant que mainteneur, je veux un test qui vérifie l'assemblage d'une relation multipolygone (contour en plusieurs morceaux dont un à l'envers, et un trou), parce que c'est le code le plus délicat de la conversion.
4. En tant que mainteneur, je veux un test qui vérifie que la mer est calculée sur les coordonnées projetées et arrondies, avec le demi-côté du lieu, pour couvrir l'appel réel du calcul de la mer.
5. En tant que mainteneur, je veux un test qui vérifie le `meta` produit, pour que le contrôle de cohérence du catalogue continue de trouver les champs du lieu.
6. En tant que mainteneur, je veux que la validation d'une réponse Overpass soit testée (réponse sans `elements`, réponse vide avec sa `remark`), parce que le téléchargement en dépend pour passer au serveur suivant.
7. En tant qu'agent qui exécute `/new-map`, je veux que `npm run fetch-data -- <lieu>` se comporte exactement comme avant : mêmes messages, mêmes serveurs, même fichier écrit.
8. En tant qu'auteur d'un style, je veux que la doc du format des données dise que le dernier point d'un anneau répète le premier, pour ne pas écrire un rendu qui suppose le contraire.

## Implementation decisions

### Module de conversion (`scripts/osm.ts`)

Interface retenue pendant la conception :

```ts
function overpassQuery(place: Place): string;
function parseOverpassAnswer(json: unknown): OverpassAnswer;
function convertOsm(answer: OverpassAnswer, placeId: PlaceId,
  source: { server: string; fetchedAt: string }): MapData;
```

- **Carré du lieu :** le demi-côté (`half`, en mètres) et la `bbox` (degrés) sont calculés à partir du lieu, comme aujourd'hui. Le calcul est interne au module ; la requête et la conversion l'utilisent toutes les deux.
- **`overpassQuery`** renvoie exactement le texte de requête actuel, timeout compris. Le timeout de la requête reste une constante du module, et le script l'utilise aussi pour le délai d'abandon d'un serveur.
- **`parseOverpassAnswer`** lève une erreur `unexpected answer` si la réponse n'est pas un objet avec un tableau `elements`, et `no elements (<remark ou « empty answer »>)` si ce tableau est vide. Sinon elle renvoie la réponse, typée. Les types de la réponse (`OverpassAnswer` et ses éléments) passent dans le module.
- **`convertOsm`** reprend sans changement de comportement :
  - la projection équirectangulaire locale et l'arrondi au dixième de mètre (`r1`) ;
  - l'assemblage des anneaux des relations et la conversion des polygones ;
  - les règles de classement, dans le même ordre ;
  - l'appel au calcul de la mer avec les lignes de côte projetées et le demi-côté ;
  - le `meta` : `place`, les champs du lieu, `bbox`, `half`, `server`, `fetchedAt` (reçu en paramètre), `osmTimestamp` s'il est présent, `attribution`.
- Le module n'accède ni au réseau, ni au système de fichiers, ni à `process`, et n'écrit rien dans la console.

### Script de téléchargement

- Il garde : la lecture et la vérification de l'id du lieu, la liste des serveurs, les tours et la pause, les messages de progression et d'échec, l'écriture au chemin des données du lieu, le tableau récapitulatif.
- Il appelle `overpassQuery`, `parseOverpassAnswer` (dans la boucle de téléchargement, une erreur faisant passer au serveur suivant) et `convertOsm` (avec la date courante en `fetchedAt`).

### Calcul de la mer

`scripts/coastline.ts` reste un module à part, utilisé par la conversion. Son interface et ses tests ne changent pas.

### Doc du format des données

Le commentaire du type `Ring` dans `src/data.ts` dit que le dernier point répète le premier. La doc des styles (`src/styles/README.md`), si elle décrit les anneaux, dit la même chose.

## Testing decisions

- **Seam :** l'interface du module de conversion. Niveau in-process : la réponse Overpass est construite dans le test, aucun réseau, aucun fichier.
- **Fixture :** une petite réponse Overpass écrite à la main dans le test, avec des géométries `out geom` en latitude/longitude autour du centre d'Amsterdam. `convertOsm` reçoit un `PlaceId` et lit le lieu dans l'index : les tests utilisent donc `amsterdam-centre` plutôt qu'un lieu fictif. La fixture contient :
  - un bâtiment simple ;
  - une relation multipolygone `building` dont le contour est en 2 morceaux (un à l'envers) et qui a un trou ;
  - un `building:part` ;
  - une route nommée sur un pont, une route `area=yes`, une route en tunnel ;
  - un canal, un `waterway=riverbank`, un plan d'eau nommé, un parc ;
  - une ligne de côte qui traverse le carré.
- **Tests (`tests/osm.test.ts`) :**
  1. Un bâtiment simple donne un anneau projeté et arrondi au dixième, dont le dernier point répète le premier.
  2. La relation multipolygone donne un bâtiment à 2 anneaux : le contour fermé, puis le trou.
  3. Un `building:part` est ignoré.
  4. La route nommée sur un pont donne `{ k, p, n, b: 1 }`. La route `area=yes` est ignorée. La route en tunnel porte `u: 1`.
  5. Le canal va dans `waterways`. Le `riverbank` et le plan d'eau vont dans `water`, le plan d'eau avec son nom.
  6. Le parc va dans `parks`, avec `k` égal à la valeur de son tag (`leisure`, `landuse` ou `natural`).
  7. La ligne de côte donne de la mer dans `water`, découpée au carré du lieu : chacun de ses points est dans `[-half, half]²`.
  8. Le `meta` reprend le lieu, `bbox`, `half`, `server`, `fetchedAt`, `osmTimestamp` et l'attribution.
  9. `parseOverpassAnswer` refuse une réponse sans `elements` et une réponse vide (le message contient la `remark`), et accepte une réponse valide.
- Chaque test qui passe dès sa première exécution est prouvé par une casse de la règle qu'il vérifie.
- **Ce qu'un bon test vérifie ici :** le `MapData` produit, jamais les fonctions internes.
- **Prior art :** `tests/coastline.test.ts`, `tests/catalogue.test.ts`.

## Global constraints

- Node ≥ 24 ; `node --test` sur les `.ts`, sans dépendance ajoutée.
- `npm run typecheck`, `npm test` et `npm run build` passent.
- Aucun fichier de `public/data/` ne change.
- Même requête Overpass, mêmes serveurs, mêmes tours et pause, mêmes messages en console qu'avant.
- Équivalence : pour une même réponse Overpass, l'ancien et le nouveau script écrivent des JSON identiques octet pour octet, une fois `fetchedAt` mis de côté.
- Le module de conversion n'utilise ni réseau, ni système de fichiers, ni `process`, ni la console.

## Out of scope

- Marquer dans les données les bords d'eau découpés par le carré.
- Fusionner les trois façons de raccorder des lignes (côte, anneaux des relations, noms des rues).
- Retirer le point répété des anneaux.
- Garder en cache la réponse Overpass brute pour reconvertir sans réseau.
- Un port avec adapter pour Overpass.

## Further notes

- Ce spec vient du candidat 3 de la revue d'architecture du 15/11/2026.
- **Vérification d'équivalence prévue**, si un serveur Overpass répond :
  1. télécharger une fois la réponse brute d'Amsterdam dans le scratchpad ;
  2. lancer l'ancien script (`main`, worktree jetable) et le nouveau en remplaçant `fetch` par cette réponse ;
  3. comparer les deux JSON produits, `fetchedAt` mis de côté.

  Si aucun serveur ne répond, le dire dans le compte rendu : l'équivalence ne reposera alors que sur les tests.
