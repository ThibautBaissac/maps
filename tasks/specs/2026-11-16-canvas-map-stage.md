# Module stage : la carte canvas complète derrière une seule interface

## Problem statement

Chaque style Canvas 2D (riso, cyanotype) recopie dans son `mount` la même séquence de câblage autour du module stage :
- la marge du carré imprimé (« moitié du carré + 40 m ») ;
- le calcul de l'échelle minimale ;
- le placement des overlays HTML via le shell ;
- la préparation et le placement des noms (projecteur, zones à éviter, fenêtre de carte) ;
- le fondu du carré ;
- les trois premières étapes de la présentation (effacer, poser le papier, poser le tampon net reprojeté).

Conséquences :

- Comprendre « quel carré est la carte » oblige à lire le style, le module stage, le viewport et la projection.
- Les zones que les noms doivent éviter sont calculées différemment selon le style. Riso utilise une boîte d'attribution de 230 × 34 px codée en dur, et ne s'en sert pas pour placer l'attribution. Cyanotype utilise des rects élargis à la main.
- Le skill `/new-map` dit de « partir de la structure de riso ». Les 4 presets en attente recopieraient chacun la séquence une fois de plus.
- Les tests ne peuvent pas passer par `mount` (DOM, `ResizeObserver`, `FontFace`). Ils appellent donc les internes des styles, `renderUI` avec 8 arguments positionnels par exemple, et le vrai câblage n'est pas testé.
- La page vignette suppose que `mount` se termine après un premier rendu net. Aucune interface ne le dit.
- Le skill `/new-map` donne une étape de vérification qui appelle `viewport.setView`, une méthode qui n'existe plus.

## Solution

Le module stage devient deep. Il prend en charge tout ce qui est commun à une carte canvas. Un style canvas lui passe un adapter qui ne décrit que ses choix graphiques :
- sa police de noms ;
- sa mise en page et ses tampons pour une taille donnée ;
- sa politique de noms selon le zoom ;
- son rendu net ;
- son mode de pose du tampon ;
- son habillage.

Le `mount` d'un style canvas se réduit à : charger les polices, préparer les données, puis renvoyer `mountCanvasMap(args, adapter)`.

Le contrat de style ne change pas pour les styles non-canvas. La garantie « rendu net fait quand `mount` se termine » fait désormais partie de l'interface. Les tests passent par le vrai `mount` des styles, sur un faux DOM.

## User stories

1. En tant qu'auteur d'un nouveau style canvas, je veux ne fournir que mes choix graphiques (police, mise en page, politique de noms, rendu, habillage), pour ne pas recopier le câblage de la carte.
2. En tant qu'auteur d'un style, je veux que la marge du carré et l'échelle minimale soient calculées pour moi à partir de la taille du carré dans ma mise en page, pour que tous les styles montrent le même carré en vue d'ensemble.
3. En tant qu'auteur d'un style, je veux déclarer où vont le groupe de navigation et l'attribution sous forme de deux rects, et que le stage place les overlays HTML à ces endroits, pour ne plus traduire moi-même des rects en marges CSS.
4. En tant qu'auteur d'un style, je veux que les noms évitent automatiquement le groupe de navigation, l'attribution et le mobilier que je déclare, pour ne plus maintenir une liste d'évitement séparée de mes rects.
5. En tant qu'auteur d'un style, je veux recevoir dans mon rendu net les noms déjà placés, le projecteur et une fonction de fondu du carré, pour choisir où et dans quel ordre je détoure, remplis et estompe (par exemple sur deux plaques).
6. En tant qu'auteur d'un style, je veux choisir le mode de composition avec lequel le tampon net est posé sur le papier (`multiply` pour riso), sans écrire moi-même la reprojection.
7. En tant qu'auteur d'un style, je veux n'écrire que mon habillage pour chaque image (mobilier, grille, cartouche, grain), le papier et la carte étant déjà posés.
8. En tant qu'auteur d'un style qui n'utilise pas canvas (WebGL, SVG), je veux que le contrat de `mount` reste le même, pour pouvoir me passer du stage.
9. En tant que page vignette, je veux que `mountCanvasMap` garantisse qu'un rendu net est sur le canvas de scène quand il se termine (si le container a une taille), pour capturer l'image sans attendre.
10. En tant que mainteneur, je veux tester riso et cyanotype à travers leur vrai `mount`, sous Node, pour couvrir le câblage réel et pas seulement les internes.
11. En tant que mainteneur, je veux un test qui vérifie la garantie de rendu net à la fin de `mount`, pour que la vignette ne casse pas sans prévenir.
12. En tant que mainteneur, je veux un test qui vérifie que riso imprime le titre du registre, écrit à travers `mount`, pour remplacer le test actuel qui appelle `renderUI` avec 8 arguments.
13. En tant que mainteneur, je veux un test qui vérifie qu'aucun nom n'est dessiné dans les rects de navigation et d'attribution, pour fixer la règle d'évitement.
14. En tant que mainteneur, je veux un test qui vérifie que le shell reçoit des emplacements tirés des rects `nav` et `attr` de la mise en page, pour que les overlays et l'évitement ne divergent plus.
15. En tant qu'agent qui exécute `/new-map`, je veux que la méthode « nouveau style » et l'étape de vérification par captures décrivent l'interface réelle, pour ne pas appeler une méthode supprimée.
16. En tant que visiteur, je veux que riso et cyanotype s'affichent comme avant (mêmes couleurs, mêmes noms, même cadrage, même navigation), à une exception près, décrite dans le point suivant.
17. En tant que visiteur, j'accepte que riso puisse retirer ou ajouter quelques noms au bord de la navigation et de l'attribution, pour deux raisons : le groupe de navigation est maintenant évité avec une marge de 4 px, et la zone évitée autour de l'attribution se décale de 2 à 4 px.

## Implementation decisions

### Interface du module stage

Forme retenue pendant la conception (les noms des champs font partie de la décision) :

```ts
interface CanvasLayout {
  map: Rect;          // fenêtre de carte, px CSS
  plate: number;      // côté du carré imprimé à l'échelle minimale, px CSS
  nav: Rect;          // emplacement du groupe lien retour + commandes, px CSS
  attr: Rect;         // emplacement de l'attribution, px CSS
  furniture: Rect[];  // mobilier dessiné que les noms évitent, px CSS
}
interface CanvasEnv { paper: CanvasImageSource; map: CanvasBuffer }

interface CrispFrame<K extends string> {
  view: View; P: Projector; dpr: number;
  labels: LabelJob<K>[];                      // déjà placés
  fade(ctx: CanvasRenderingContext2D): void;  // fondu du carré
}

interface CanvasStyle<E extends CanvasEnv, K extends string> {
  font: string;
  resize(size: StageSize, ctx: CanvasRenderingContext2D): { env: E; layout: CanvasLayout };
  labels(view: View, names: Labels): LabelGroup<K>[];
  render(env: E, frame: CrispFrame<K>): void;
  blend?: GlobalCompositeOperation;
  overlay(ctx: CanvasRenderingContext2D, env: E, view: View): void;
}

function mountCanvasMap<E extends CanvasEnv, K extends string>(
  args: Pick<MountArgs<unknown>, 'container' | 'data' | 'shell'>,
  style: CanvasStyle<E, K>,
): MapHandle;
```

### Ce qui devient interne au stage

- **Marge du carré :** constante de 40 m, documentée. Le demi-côté du carré navigable vaut `data.meta.half + 40`. Elle n'est pas réglable par style.
- **Échelle minimale :** `layout.plate / (2 × demi-côté du carré navigable)`.
- **Placement des overlays :** à chaque resize, le stage appelle `shell.place` :
  - `back` reçoit `left` / `top` tirés de `nav[0]` / `nav[1]` ;
  - `attribution` reçoit `right` = largeur − `attr[2]` et `bottom` = hauteur − `attr[3]`.
- **Noms :**
  - `prepareLabels(data)` est appelé une seule fois, au montage.
  - À chaque rendu net, le stage construit le projecteur pour la vue, demande les groupes au style via `labels(view, names)`, puis appelle `placeLabels`. Il lui passe :
    - la police du style ;
    - la mesure du texte sur le contexte de `env.map` ;
    - la fenêtre de carte en px device ;
    - la liste d'évitement : `furniture`, plus `nav` et `attr` élargis de 4 px de chaque côté, le tout converti en px device.
- **Fondu :** `frame.fade(ctx)` applique le fondu du carré avec le demi-côté du carré navigable. C'est le style qui décide quand l'appeler et sur quels tampons.
- **Présentation, pour chaque image :** effacer le canvas de scène, poser `env.paper`, poser `env.map` reprojeté de la vue nette vers la vue courante, découpé à la fenêtre de carte, avec `blend` (`source-over` par défaut). Le stage appelle ensuite `style.overlay`. Le stage laisse le contexte avec une transformation identité, une opacité de 1 et la composition `source-over` avant d'appeler `overlay`.
- La reprojection n'est plus exportée par le module stage.
- **Garantie de fin de montage :** `mountCanvasMap` se termine après le premier rendu net et sa présentation sur le canvas de scène, si le container a une taille non nulle. Sinon, ce premier rendu a lieu au premier resize. La garantie est écrite dans le commentaire d'interface et dans la doc du contrat de style. `MapHandle` reste le même : `viewport`, `destroy`, `full`.

### Riso

- `mount` se réduit à : fusionner les options, charger la police, préparer les plaques et les textures indépendantes de la taille, puis `return mountCanvasMap(args, adapter)`.
- `render` garde l'ordre actuel :
  1. plaques A et B ;
  2. détourage des noms sur les deux plaques ;
  3. remplissage de chaque nom dans l'encre de sa plaque ;
  4. `fade` sur les deux plaques ;
  5. texture d'encre ;
  6. fusion des deux plaques dans `env.map`.
- `blend` vaut `multiply`.
- `overlay` garde la réserve de papier sous le mobilier, le cache du mobilier (re-rendu seulement quand l'échelle change) et le grain.
- La politique de noms (nombres, tailles, encres selon le zoom) ne change pas. Elle devient le hook `labels`.
- La mise en page type du toolkit (`computeLayout`) gagne un rect `attr`. Il est placé comme l'attribution riso actuelle : son coin bas-droit est à 6 px à l'intérieur du coin bas-droit de la fenêtre de carte. Sa taille est de 224 × 28 px. Avec la marge d'évitement de 4 px, cela retrouve à peu près la boîte de 230 × 34 px actuelle.
- La fonction toolkit des zones à éviter (`avoidBoxes`) disparaît. Le mobilier riso déclaré en `furniture` regroupe les rects de réserve et les boîtes englobantes des cercles de réserve. Ce sont exactement les éléments, autres que `nav` et l'attribution, qu'`avoidBoxes` renvoie aujourd'hui.

### Cyanotype

- `mount` se réduit de la même façon. `shell.theme({ font })` reste dans `mount`.
- `render` : dessin de la carte, détourage, remplissage dans la couleur du trait, puis `fade`.
- `blend` est absent (`source-over`).
- `overlay` dessine la grille, la bordure et le cartouche. Il pose lui-même sa transformation px CSS → px device, puis rétablit l'identité.
- `furniture` vaut `[cart]` élargi de 4 px. C'est ce que fait la liste d'évitement actuelle. `nav` et `attr` reprennent les rects actuels de la mise en page cyanotype.

### Polices

`loadFont` lit la base des URL avec `import.meta.env?.BASE_URL ?? '/'`, pour qu'un `mount` puisse s'exécuter sous Node.

### Documentation

Trois documents sont mis à jour :
- la doc des styles : la ligne du stage dans la table de la boîte à outils, la ligne de la mise en page, et la garantie de fin de montage dans le contrat ;
- la méthode « nouveau style » du skill `/new-map` : l'étape 3 décrit l'adapter (`font`, `resize`, `labels`, `render`, `blend`, `overlay`) et non plus `onResize` / `render` / `present` ;
- l'étape de vérification par captures du skill `/new-map` : elle n'appelle plus `setView`. Elle zoome avec `window.__map.viewport.zoom(facteur)` et force un rendu net avec `full()`.

## Testing decisions

- **Seam :** le `mount` exporté par chaque style, c'est-à-dire l'interface de prod. Aucun paramètre réservé aux tests n'est ajouté à `mountCanvasMap`, ni au viewport.
- **Adapter de test (local-substitutable) :** un module de test installe un faux DOM global.
  - `document.createElement('canvas')` renvoie un faux canvas. Son contexte 2D est un Proxy qui enregistre chaque appel et chaque affectation de propriété. Il fournit `canvas` (lien vers le faux canvas), `measureText`, `createPattern` (un objet, jamais `null`), `getImageData` / `createImageData` (des tableaux de la bonne taille) et `putImageData`.
  - Le faux DOM fournit aussi un container avec `clientWidth`, `clientHeight`, `append` et `addEventListener`, ainsi que `ResizeObserver` (sans effet), `window.devicePixelRatio`, `setTimeout`, `clearTimeout`, `requestAnimationFrame`, `cancelAnimationFrame`, `FontFace` et `document.fonts`.
  - Le shell est un faux qui enregistre les appels à `place` et à `theme`, et expose un `label`.
  - Le module de test retire tout ce qu'il a installé après chaque test.
- **Fixture :** les données d'Amsterdam déjà utilisées par les tests de rendu.
- **Tests, à travers `riso.mount` et `cyanotype.mount` :**
  1. Pour chacun des deux styles : quand `mount` se termine, le canvas de scène a déjà reçu un `drawImage` du papier et un `drawImage` du tampon de carte.
  2. Riso imprime le titre du registre (`meta.title`) et pas le nom du lieu. On le vérifie par les appels `fillText`, enregistrés sur l'ensemble des contextes créés.
  3. Pour chacun des deux styles : aucune lettre de nom n'est dessinée dans les rects `nav` ou `attr`, convertis en px device. Les rects attendus sont lus dans la mise en page, via le dernier appel à `shell.place`.
     - On reconnaît une lettre de nom par sa façon d'être dessinée : `fillText` ou `strokeText` d'un seul caractère en (0, 0), juste après un `setTransform(1, 0, 0, 1, x, y)` puis un `rotate`.
     - Le point d'ancrage de la lettre est (x, y).
  4. Pour chacun des deux styles : l'appel à `shell.place` correspond à la mise en page du style pour la taille du faux container : `back.left` / `back.top` valent `nav[0]` / `nav[1]` ; `attribution.right` / `attribution.bottom` valent la largeur − `attr[2]` / la hauteur − `attr[3]`.
- **Ce qui est supprimé :** le test qui appelle `renderUI` directement, remplacé par le test 2.
- **Ce qui est conservé :** le test du pont cyanotype, qui cible l'interface du module de rendu de carte cyanotype.
- **Ce qu'un bon test vérifie ici :** des appels observables sur les contextes et sur le shell, jamais l'état interne de l'`env`.

## Global constraints

- Node ≥ 24 ; tests avec `node --test` sur les `.ts`, sans dépendance de test ajoutée.
- TypeScript strict, `noUncheckedIndexedAccess` : `npm run typecheck` passe sans erreur.
- `npm test` passe, test du pont cyanotype compris.
- Aucune nouvelle dépendance npm.
- Marge du carré : 40 m. Marge d'évitement de `nav` et `attr` : 4 px CSS.
- Rendu visuel de riso et cyanotype inchangé à 3 zooms (vue d'ensemble, environ 1 px/m, environ 4 px/m), à une exception près : riso peut perdre ou gagner des noms à moins de 4 px du groupe de navigation et de l'attribution.
- Budgets de performance inchangés : rendu net en vue d'ensemble < 100 ms à une densité de pixels de 2, et aucun re-rendu de la carte pendant le zoom.
- La doc, les commentaires d'interface et la prose suivent la langue des fichiers existants : le français pour la doc des styles et le skill, l'anglais pour les commentaires de code.

## Out of scope

- Mesurer la vraie taille des overlays HTML depuis le DOM (le shell propriétaire de la géométrie des overlays). Les rects `nav` et `attr` restent calculés par la mise en page du style.
- Une politique de noms commune sous forme de table de données. Les nombres restent des choix de chaque style.
- Le détourage et le remplissage des noms par le stage. Ils restent dans le `render` du style.
- Rendre la marge du carré réglable.
- Faire de la déclaration de style un objet consommé par un `mount` générique. Chaque style garde son `mount`.
- Injecter une fabrique de canvas dans le toolkit.
- Le catalogue de cartes, l'extraction de la conversion OSM et la déclaration de style regroupée dans son dossier (les autres candidats de la revue d'architecture).

## Further notes

- Ce spec vient du candidat 1 de la revue d'architecture du 15/11/2026. Il est conçu pour que le candidat « shell propriétaire de la géométrie des overlays » vienne plus tard remplacer l'origine des rects `nav` et `attr`, sans toucher à l'interface du stage.
- Vérification visuelle :
  - avant de commencer, faire des captures de `main` pour les deux cartes (Amsterdam en riso, Lisbonne en cyanotype, d'après le registre) aux trois zooms ;
  - refaire les mêmes captures après le changement et les comparer.
