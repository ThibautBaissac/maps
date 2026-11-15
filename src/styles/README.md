# Styles

Un style dessine toute la page d'une carte. Il reçoit la scène et les données, et en fait ce qu'il veut : Canvas 2D, WebGL, SVG, animation, mise en page propre. La boîte à outils (`src/toolkit/`) l'aide sans rien imposer.

## Contrat

Un style est un dossier `src/styles/<nom>/` dont `index.js` exporte :

```js
export async function mount({ container, data, meta, options, shell }) {
  // construit la page dans `container` et commence à dessiner
  return { destroy() {} };
}
```

| Argument | Contenu |
|---|---|
| `container` | `<div id="stage">` vide qui remplit la fenêtre |
| `data` | les données OSM du lieu (format plus bas) |
| `meta` | `data.meta` plus `title` (titre du registre ou nom du lieu) |
| `options` | les `options` de la carte dans `src/registry.js`, à fusionner avec le `defaults.js` du style |
| `shell` | le cadre de page commun (plus bas) |

Le style se déclare ensuite dans `src/styles/index.js` avec un libellé, un `load()` paresseux et un `card(options)` qui renvoie `{ bg, fg, accent }` pour la galerie (avec `dark: true` si le style trace en clair sur un fond sombre : la galerie inverse alors son mélange de couleurs).

### Ce que tout style doit respecter

- L'attribution OSM et le lien retour restent visibles : les positionner avec `shell.place(...)`, les habiller avec `shell.theme(...)`, ne jamais les masquer.
- La navigation au clavier et à la souris fonctionne (le viewport de la boîte à outils gère les deux).
- Aucune requête vers un serveur extérieur : les polices vont dans `public/fonts/` avec leur licence et se chargent avec `loadFont()`.
- S'inspirer d'un genre, jamais copier une œuvre existante.

### Shell

- `shell.label` : description accessible à poser sur l'élément focalisable (`aria-label`).
- `shell.place({ back: { left, top, right, bottom }, attribution: { … } })` : en px CSS ; une valeur absente garde le coin par défaut (lien retour en haut à gauche, attribution en bas à droite).
- `shell.theme({ bg, accent, font })` : couleurs et police des éléments HTML superposés.

## Données

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
| `viewport.js` | `createViewport()` : vue `{ x, y, s }`, navigation molette/glisser/clavier, `onFrame` pendant le mouvement, `onSettle` pour le rendu net ; `reprojection()` pour réutiliser la dernière image nette pendant le mouvement |
| `canvas.js` | canvas de scène focalisable, dimensionnement selon la densité de pixels, tampons hors écran |
| `projection.js` | mètres → px avec tremblé du trait facultatif, construction de tracés, élimination hors écran, fondu du carré |
| `labels.js` | noms candidats tirés des données, placement le long des lignes sans collision, dessin des lettres |
| `layout.js` | une mise en page type (cadre, fenêtre de carte, emplacements du cartouche, de la rose des vents, de la légende) et les pas de l'échelle ; à prendre, adapter ou ignorer |
| `noise.js` | aléatoire reproductible, bruit, canvas de pixels pour les textures |
| `fonts.js` | `loadFont(famille, fichier)` depuis `public/fonts/` |

`riso/` sert de référence : un style Canvas 2D qui utilise l'essentiel de la boîte à outils.
