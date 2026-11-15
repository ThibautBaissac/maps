# Styles

Un style dessine toute la page d'une carte. Il reçoit la scène et les données, et en fait ce qu'il veut : Canvas 2D, WebGL, SVG, animation, mise en page propre. La boîte à outils (`src/toolkit/`) l'aide sans rien imposer.

## Contrat

Un style est un dossier `src/styles/<nom>/` dont `index.ts` exporte une fonction `mount` typée par `contract.ts` :

```ts
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type NomOptions } from './defaults.ts';

export async function mount({ container, data, meta, options, shell }: MountArgs<NomOptions>): Promise<MapHandle> {
  const o: NomOptions = { ...DEFAULTS, ...options };
  // construit la page dans `container` et commence à dessiner
  return { destroy() {} };
}
```

| Argument | Contenu |
|---|---|
| `container` | `<div id="stage">` vide qui remplit la fenêtre |
| `data` | les données OSM du lieu (format plus bas) |
| `meta` | `data.meta` plus `title` (titre du registre ou nom du lieu) |
| `options` | les `options` de la carte dans `src/registry.ts`, à fusionner avec le `defaults.ts` du style |
| `shell` | le cadre de page commun (plus bas) |

`defaults.ts` exporte l'interface des options du style (`NomOptions`, chaque champ documenté) et `DEFAULTS`, ses valeurs par défaut.

Le style se déclare ensuite dans `src/styles/index.ts` : son interface d'options dans `StyleOptions` (la clé devient un nom de style valide dans le registre, et les `options` de ses cartes sont vérifiées contre cette interface), puis dans `STYLES` un libellé, une `legend` textuelle expliquant ses symboles, un `load()` paresseux et un `card(options)` qui renvoie `{ bg, fg, accent }` pour la galerie (avec `dark: true` si le style trace en clair sur un fond sombre : la galerie inverse alors son mélange de couleurs).

La page branche ses boutons de zoom sur le champ facultatif `viewport` de `MapHandle`. Un style qui utilise le viewport de la boîte à outils le renvoie pour activer ces boutons ; sinon il fournit ses propres commandes. En développement, la valeur renvoyée par `mount` est exposée dans `window.__map`, avec `full()` pour les vérifications de rendu.

### Ce que tout style doit respecter

- L'attribution OSM et les commandes communes restent visibles : les positionner avec `shell.place(...)`, les habiller avec `shell.theme(...)`, ne jamais les masquer. Réserver la zone de navigation au lien retour, aux boutons de zoom et au bouton de description.
- La navigation au clavier et à la souris fonctionne (le viewport de la boîte à outils gère les deux).
- Aucune requête vers un serveur extérieur : les polices vont dans `public/fonts/` avec leur licence et se chargent avec `loadFont()`.
- S'inspirer d'un genre, jamais copier une œuvre existante.

### Shell

- `shell.label` : description accessible à poser sur l'élément focalisable (`aria-label`).
- `shell.place({ back: { left, top, right, bottom }, attribution: { … } })` : en px CSS ; `back` place le groupe du lien retour et des commandes. Une valeur absente garde le coin par défaut (commandes en haut à gauche, attribution en bas à droite).
- `shell.theme({ bg, accent, font })` : couleurs et police des éléments HTML superposés.

## Données

Les types font foi : `MapData` et ses éléments dans `src/data.ts`, `Place` dans `src/place.ts`. Les deux tournent aussi sous Node (`scripts/fetch-osm.ts`, `vite.config.ts`) : ni DOM ni API Node dedans.

`data.meta` : `name`, `district`, `lat`, `lon`, `sizeKm`, `half` (mètres du centre au bord du carré), `attribution`, date de téléchargement. Les coordonnées sont en mètres locaux, x vers l'est, y vers le nord, origine au centre du lieu ; les géométries sont des tableaux plats `[x0, y0, x1, y1, …]`.

| Clé | Éléments |
|---|---|
| `buildings` | `[anneau, anneau…]` (le premier extérieur, les suivants des trous) |
| `roads` | `{ k: type highway, p: ligne, n?: nom, b?: pont, u?: tunnel }` |
| `waterways` | `{ k: type waterway, p: ligne, n?, u? }` |
| `water` | `{ r: anneaux, n? }` : plans d'eau, plus la mer ou l'estuaire reconstitués à partir du littoral OSM (`natural=coastline`), découpés au carré du lieu |
| `parks` | `{ k: valeur leisure/landuse/natural, r: anneaux }` |

## Boîte à outils

| Module | Fournit |
|---|---|
| `viewport.ts` | `createViewport()` : vue `{ x, y, s }`, navigation molette/glisser/clavier, `onFrame` pendant le mouvement, `onSettle` pour le rendu net ; `reprojection()` pour réutiliser la dernière image nette pendant le mouvement |
| `canvas.ts` | canvas de scène focalisable, dimensionnement selon la densité de pixels, tampons hors écran ; `context2d()` et `pattern()`, qui lèvent une erreur au lieu de renvoyer `null` |
| `projection.ts` | mètres → px avec tremblé du trait facultatif, construction de tracés, élimination hors écran, fondu du carré |
| `labels.ts` | noms candidats tirés des données, placement le long des lignes sans collision, dessin des lettres ; `LabelGroup<K>` porte l'étiquette propre au style (encre, couleur…) jusqu'aux `LabelJob<K>` |
| `layout.ts` | une mise en page type (cadre, fenêtre de carte, emplacements du cartouche, de la rose des vents, de la légende) et les pas de l'échelle ; à prendre, adapter ou ignorer |
| `geometry.ts` | types `Point`, `Rect`, `Circle`, `scaleRect()`, et des aides typées pour les objets à clés connues (`typedKeys`, `isKeyOf`, `recordOf`) |
| `noise.ts` | aléatoire reproductible, bruit, canvas de pixels pour les textures |
| `fonts.ts` | `loadFont(famille, fichier)` depuis `public/fonts/` |

Les géométries sont des tableaux plats lus par indice. Avec `noUncheckedIndexedAccess`, `r[i]` vaut `number | undefined` : dans une boucle bornée par la longueur, `r[i]!` est accepté et documenté en tête du module ; ailleurs, préférer les tuples (`Point`, `Rect`).

`riso/` sert de référence : un style Canvas 2D qui utilise l'essentiel de la boîte à outils.
