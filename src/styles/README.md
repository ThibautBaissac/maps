# Styles

Un style dessine toute la page d'une carte. Il reçoit la scène et les données, et en fait ce qu'il veut : Canvas 2D, WebGL, SVG, animation, mise en page propre. La boîte à outils (`src/toolkit/`) l'aide sans rien imposer.

## Contrat

Un style est un dossier `src/styles/<nom>/` dont `index.ts` exporte une fonction `mount` typée par `contract.ts` :

```ts
import type { MapHandle, MountArgs } from '../contract.ts';
import { DEFAULTS, type NomOptions } from './defaults.ts';

export async function mount({ container, meta, locale, options, shell, layers }: MountArgs<NomOptions>): Promise<MapHandle> {
  const o: NomOptions = { ...DEFAULTS, ...options };
  // construit la page dans `container` et commence à dessiner
  return { destroy() {} };
}
```

| Argument | Contenu |
|---|---|
| `container` | `<div id="stage">` vide qui remplit la fenêtre |
| `meta` | `title` et `district` dans la langue de la page, résolus par `src/catalogue.ts` (imprimer ces valeurs), `place`, `lat`, `lon`, `sizeKm`, `half`, `bbox`, `osmDate` (date des données OSM) et `attribution` |
| `locale` | langue de la page ; utiliser `messages(locale)` et les fonctions de formatage de `src/i18n/index.ts` pour les textes dessinés |
| `options` | les `options` de la carte dans `src/registry.ts`, à fusionner avec le `defaults.ts` du style |
| `shell` | le cadre de page commun (plus bas) |
| `layers` | couches extérieures de la carte (`Layer[]` de `src/layers.ts`, déclarées dans `places/layers.ts` et le champ `layers` de la carte), déjà en mètres locaux ; `[]` sans couche. Un style Canvas les dessine avec `drawLayers()`, un autre les traite comme il l'entend |
| `topic` | analyse du sujet validé, si présent : géométries retenues, longueurs, secteurs et repères. La page utilise la même analyse pour le texte ; le style l’utilise pour mettre le sujet en évidence. |

`defaults.ts` exporte l'interface des options du style (`NomOptions`, chaque champ documenté) et `DEFAULTS`, ses valeurs par défaut.

Le style se déclare ensuite dans `src/styles/index.ts` : son interface d'options dans `StyleOptions` (la clé devient un nom de style valide dans le registre, et les `options` de ses cartes sont vérifiées contre cette interface), puis dans `STYLES` ses textes français issus de `messages('fr').styles`, un `load()` paresseux et un `card(options)` qui renvoie `{ bg, fg, accent }` pour la galerie (avec `dark: true` si le style trace en clair sur un fond sombre : la galerie inverse alors son mélange de couleurs). Chaque dictionnaire fournit son libellé et sa légende textuelle ; le catalogue choisit ceux de la page.

`mount` ne se termine qu'une fois la carte dessinée : la capture de vignette lit le canvas de `#stage` dès que la promesse est résolue (`mountCanvasMap()` le garantit si la scène a une taille).

La page branche ses boutons de zoom sur le champ facultatif `viewport` de `MapHandle`. Un style qui utilise le viewport de la boîte à outils le renvoie pour activer ces boutons ; sinon il fournit ses propres commandes. En développement, la valeur renvoyée par `mount` est exposée dans `window.__map`, avec `full()` pour les vérifications de rendu.

Les styles Canvas existants utilisent `drawTopic()` pour les tronçons et `drawTopicMarkers()` pour les repères numérotés après le fondu. Ils transmettent aussi `topic` à `mountCanvasMap()` pour que les noms évitent les numéros. Les commandes des repères utilisent `viewport.goTo()` ; une échelle de zéro restaure la vue générale en respectant la taille actuelle du plan.

### Ce que tout style doit respecter

- Le lien retour et les langues restent dans l’en-tête, au-dessus du plan. La zone de commandes du plan contient le zoom et la description. Positionner ce groupe et l’attribution OSM avec `shell.place(...)` (le stage le fait pour `mountCanvasMap()`), les habiller avec `shell.theme(...)` et les garder visibles.
- La navigation au clavier et à la souris fonctionne (le viewport de la boîte à outils gère les deux).
- Aucune requête vers un serveur extérieur : les polices vont dans `public/fonts/` avec leur licence et se chargent avec `loadFont()`.
- S'inspirer d'un genre, jamais copier une œuvre existante.

### Shell

- `shell.label` : description accessible à poser sur l'élément focalisable (`aria-label`).
- `shell.place({ back: { left, top, right, bottom }, attribution: { … } })` : en px CSS ; `back` place les commandes de zoom et de description dans le plan. Une valeur absente garde le coin par défaut (commandes en haut à gauche, attribution en bas à droite).
- `shell.theme({ bg, accent, font })` : couleurs et police des éléments HTML superposés.

## Données

Une carte reçoit ses données sous forme de **couches** (`Layer`, `src/layers.ts`), dans `MountArgs.layers`. Les types font foi : `Layer`, `Feature` et leurs aides dans `src/layers.ts`, `Place` dans `src/place.ts`. Les deux tournent aussi sous Node (`scripts/fetch-osm.ts`, `vite.config.ts`) : ni DOM ni API Node dedans. Ce que la carte imprime sur elle-même (titre, carré, date, attribution) vient de `MountArgs.meta`.

Les coordonnées sont en mètres locaux, x vers l'est, y vers le nord, origine au centre du lieu, arrondies à 0,1 m ; les géométries sont des tableaux plats `[x0, y0, x1, y1, …]`. Un anneau tiré d'un chemin OSM répète son premier point à la fin, mais pas forcément un anneau de mer reconstitué à partir du littoral, ni celui d'une relation incomplète : fermer le tracé soi-même (`closePath()`) plutôt que compter sur cette répétition.

Une couche porte un `id`, un `kind` (`points`, `lines` ou `areas`), un `role`, une `attribution` non vide, une `source` et ses `features`. Chaque objet est `{ g, k?, n?, p? }` : `g` la géométrie (un point `[x, y]`, une ligne, ou des anneaux dont le premier est extérieur et les suivants des trous), `k` la catégorie, `n` le nom, `p` des propriétés scalaires.

Les couches OpenStreetMap (`public/data/<lieu>/osm.json`, écrites par `npm run fetch-data`) sont six, dans l'ordre où les styles les dessinent. Un fichier converti avant l'ajout des parties de bâtiment s'arrête à `parks` et reste valide. Leur `id` est leur rôle ; `osm` est réservé :

| Rôle (`id`) | Genre | Objets |
|---|---|---|
| `buildings` | `areas` | `{ g: anneaux, n?, p?: { h?, base?, year?, parts? } }` (le premier anneau extérieur, les suivants des trous) |
| `roads` | `lines` | `{ g: ligne, k: type highway, n?: nom, p?: { bridge?, tunnel? } }` |
| `waterways` | `lines` | `{ g: ligne, k: type waterway, n?, p?: { tunnel? } }` |
| `water` | `areas` | `{ g: anneaux, n? }` : plans d'eau, plus la mer ou l'estuaire reconstitués à partir du littoral OSM (`natural=coastline`), découpés au carré du lieu |
| `parks` | `areas` | `{ g: anneaux, k: valeur leisure/landuse/natural }` |
| `building-parts` | `areas` | `{ g: anneaux, p?: { h?, base?, year? } }` : parties de bâtiment (`building:part`), qui détaillent les volumes |

Hauteurs des bâtiments et des parties, en mètres : `h` le sommet (tag `height`, sinon `building:levels` × 3,2 m), `base` le bas d'une partie posée en hauteur (`min_height`, sinon `building:min_level` × 3,2 m), `year` l'année de début de construction (`start_date`). `parts: true` marque un bâtiment dont le contour contient le centre d'au moins une partie : un style en relief dessine alors les parties à la place du contour. Lire ces valeurs avec `heightOf()`, `baseOf()`, `yearOf()` et `hasParts()` de `src/layers.ts`. Les styles à plat les ignorent.

Les couches extérieures ont le rôle `overlay` et se dessinent par-dessus la carte (`drawLayers()`).

Pour lire les couches, ne pas chercher une couche par son `id` : `featuresOf(layers, role, kind)` renvoie les objets de toutes les couches d'un rôle et d'un genre, dans l'ordre des couches. `isBridge(f)` et `isTunnel(f)` lisent les propriétés `p.bridge` et `p.tunnel` d'une route ou d'un cours d'eau. `RoadKind` (valeurs `highway` retenues) et `isRoadKind()` sont dans le même module.

## Boîte à outils

| Module | Fournit |
|---|---|
| `stage.ts` | `mountCanvasMap(args, adapter)` : toute la carte Canvas 2D. Canvas de scène, viewport, boucle « rendu net à l'arrêt, image re-projetée en mouvement », carré imprimé (marge de 40 m, échelle minimale, fondu), placement du lien retour et de l'attribution, placement des noms à l'écart des overlays et du mobilier, pose du papier et du tampon net. L'adapter (`CanvasStyle`) ne porte que les choix graphiques : `font`, `resize` (tampons et mise en page), `labels` (quels noms selon le zoom), `render` (rendu net, reçoit les noms placés et `fade`), `blend`, `overlay` (habillage) |
| `viewport.ts` | `createViewport()` : vue `{ x, y, s }`, navigation molette/glisser/clavier, `onFrame` pendant le mouvement, `onSettle` pour le rendu net ; `reprojection()` pour réutiliser la dernière image nette pendant le mouvement |
| `canvas.ts` | canvas de scène focalisable, dimensionnement selon la densité de pixels, tampons hors écran ; `context2d()` et `pattern()`, qui lèvent une erreur au lieu de renvoyer `null` |
| `projection.ts` | mètres → px avec tremblé du trait facultatif, construction de tracés, élimination hors écran, fondu du carré |
| `labels.ts` | noms candidats tirés des données, placement le long des lignes sans collision, dessin des lettres (`knockOutLabels()` pour le halo, `fillLabels()`) ; `LabelGroup<K>` porte l'étiquette propre au style (encre, couleur…) jusqu'aux `LabelJob<K>` |
| `layout.ts` | `mapWindow()` (cadre, fenêtre de carte, taille du carré, zone de navigation) partagé par toutes les mises en page, une mise en page type (`computeLayout()` : emplacements du cartouche, de la rose des vents, de la légende, de l'attribution, et mobilier à éviter ; elle se passe telle quelle à `mountCanvasMap()`) et les pas de l'échelle ; à prendre, adapter ou ignorer |
| `layers.ts` | `drawLayers(ctx, P, layers, ink)` : dessin générique des couches de rôle `overlay` (points en disques, lignes, surfaces à fond semi-transparent et contour), d'une seule encre ; ne fait rien sans couche, ce qui laisse la carte inchangée. Un style l'appelle dans `render()` avec ses propres couleurs |
| `geometry.ts` | types `Point`, `Rect`, `Circle`, `scaleRect()`, et des aides typées pour les objets à clés connues (`typedKeys`, `isKeyOf`, `recordOf`) |
| `noise.ts` | aléatoire reproductible, bruit, canvas de pixels pour les textures |
| `fonts.ts` | `loadFont(famille, fichier)` depuis `public/fonts/` |

Les géométries sont des tableaux plats lus par indice. Avec `noUncheckedIndexedAccess`, `r[i]` vaut `number | undefined` : dans une boucle bornée par la longueur, `r[i]!` est accepté et documenté en tête du module ; ailleurs, préférer les tuples (`Point`, `Rect`).

`riso/` sert de référence : un style Canvas 2D qui utilise l'essentiel de la boîte à outils.
