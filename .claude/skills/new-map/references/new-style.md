# Coder un nouveau style

À lire avant d'écrire `src/styles/<clé>/`. Le contrat exact (`mount`, `shell`, format des données) est dans `src/styles/README.md`. Ce fichier donne la méthode et les leçons déjà apprises sur ce projet.

## Méthode

1. **Lire le preset ligne par ligne** et classer chaque consigne : fond, bâtiments, rues, eau, parcs, noms, habillage (cadre, titre, rose des vents, échelle, légende), effets globaux (grain, lueur, décalage).
2. **Choisir la technique.** Canvas 2D avec la boîte à outils couvre la plupart des styles ; `riso/` montre l'assemblage complet. WebGL ou SVG si le style l'exige vraiment (relief, très nombreux effets par pixel) : le contrat le permet, il suffit de construire la page dans `container`.
3. **Partir de la structure de riso**, sans copier ses choix graphiques. `mount()` charge les polices, prépare les données une fois, crée les textures indépendantes de la taille, puis renvoie `mountCanvasMap({ container, data, shell }, adapter)` (`toolkit/stage.ts`). Le stage gère canvas, viewport, boucle de rendu, carré imprimé et son fondu, placement du lien retour et de l'attribution, placement des noms et pose du papier et du tampon net. L'adapter ne fournit que les choix graphiques :
   - `font` : police des noms ;
   - `resize()` : tampons, textures et mise en page qui dépendent de la taille ; renvoie `{ env, layout }`, où `env` contient au moins `paper` (fond de page) et `map` (tampon du rendu net), et `layout` donne `map`, `plate`, `nav`, `attr` et `furniture` ;
   - `labels(view, names)` : quels noms, à quelle taille et de quel type (`kind`) selon le zoom ;
   - `render(env, frame)` : rendu net complet dans `env.map`, à l'arrêt ; `frame` apporte le projecteur `P`, les noms déjà placés (`labels`) et `fade(ctx)` pour estomper le carré ;
   - `blend` (facultatif) : mode de pose de `env.map` sur le papier, par exemple `'multiply'` ;
   - `overlay()` : habillage bon marché à chaque image, papier et carte déjà posés.
4. **Mise en page** : `mapWindow()` donne cadre, fenêtre de carte, taille du carré et zone de commandes pour une marge et une bande choisies. `computeLayout()` donne une seule disposition, celle de riso (cadre, fenêtre de carte, cartouche à gauche ou en bas, rose des vents et légende à droite). Elle n'a pas de variantes. Pour une autre disposition (cartouche en bas à droite, bandeau en haut, aucun cadre), écris la mise en page du style : partir du résultat de `computeLayout()` et déplacer les emplacements, ou tout calculer soi-même. La mise en page du style doit seulement donner la fenêtre de carte, la taille du carré, les emplacements `nav` et `attr` des commandes du plan et de l'attribution (le stage y place les éléments HTML) et le mobilier dessiné que les noms évitent. Le lien retour et les langues restent dans l’en-tête de la page. Si plusieurs styles finissent par écrire la même disposition, c'est le signe qu'il faut l'ajouter à `layout.ts`.
5. **`defaults.ts`** : une interface `<Nom>Options` (chaque champ commenté) et `DEFAULTS`. Chaque couleur, épaisseur et taille de police réglable y figure, pour qu'une variante ne demande qu'une ligne d'`options` dans le registre, vérifiée par le type-checking.
6. **Déclaration** dans `src/styles/index.ts` : ajouter l'interface d'options à `StyleOptions`, puis l'entrée de `STYLES`. **`card(options)`** : `{ bg, fg, accent }` pour la galerie et pour habiller le lien retour, l'attribution et le message de chargement. `shell.theme({ font })` règle leur police. Pour un style **clair sur fond sombre** (cyanotype, néon), ajoute `dark: true` : la galerie mélange par défaut ses couleurs comme de l'encre sur du papier clair, et rendrait la carte illisible sans ce réglage. Vérifie la carte du style dans la galerie, et le contraste du lien retour et de l'attribution sur la page.

## Polices

Toutes les polices Google Fonts du catalogue sont sous licence OFL : on peut les redistribuer avec leur licence.
1. Trouver le dossier : `https://api.github.com/repos/google/fonts/contents/ofl/<nom-en-minuscules-sans-espaces>` (par exemple `imfellenglish`, `spacemono`, `caveat`, `poiretone`, `orbitron`).
2. Télécharger le ou les `.ttf` nécessaires et `OFL.txt` dans `public/fonts/<famille>/`.
3. Dans `mount()` : `await loadFont('Space Mono', 'spacemono/SpaceMono-Regular.ttf')`. Pour une police variable (`[wght]` dans le nom), passer `{ weight: '400 700' }`.

## Budgets de performance

Mesurés sur cette machine, à une densité de pixels de 2 :
- **rendu net** (`onSettle`) en vue d'ensemble, une fois la page chargée : idéalement < 50 ms, au plus ~100 ms ;
- **image en mouvement** (`onFrame`) : quelques millisecondes ; jamais de re-rendu de la carte pendant le zoom ;
- **taille des données** : 2 Mo pour 2 km × 2 km dans un centre-ville dense.

**Mesurer le vrai coût.** Le navigateur envoie le dessin à la carte graphique et rend la main aussitôt. Un chronomètre autour du seul rendu (par exemple la fonction `full()` de la poignée de développement `window.__map`) ne voit donc que la préparation. Il affiche quelques millisecondes même quand le dessin réel est lent. Pour forcer la fin du dessin, terminer la mesure par la lecture d'un seul pixel du canvas visible :

```js
// console du navigateur
const c = document.querySelector('#stage canvas'), x = c.getContext('2d');
const t = performance.now(); window.__map.full(); x.getImageData(0, 0, 1, 1); performance.now() - t;
```

Relancer trois ou quatre fois et garder la valeur stable, pas la première, qui inclut la mise en route. Ne pas faire de dizaines de lectures : au-delà de quelques-unes, Chrome repasse le canvas en rendu logiciel et toutes les mesures suivantes deviennent fausses (recharger la page remet tout en ordre). Pour la fluidité du zoom, juger aussi à l'œil avec une vraie molette, le panneau Browser visible.

## Pièges déjà rencontrés

- **Un seul énorme tracé est très lent.** Remplir 11 000 bâtiments en un seul `fill()` prenait 750 ms ; un `beginPath()`/`fill()` par bâtiment, 16 ms. Grouper par petits paquets, ou par élément.
- **`shadowBlur` par élément est coûteux.** Pour une lueur (néon), dessiner les traits dans un tampon, puis le recopier flouté en une seule opération, sous les traits nets. `ctx.filter = 'blur(…)'` n'est pas reconnu partout (Safari) : le repli universel consiste à réduire le tampon (¼ ou ⅛) puis à l'agrandir avec lissage.
- **Motifs à l'échelle de l'écran.** Hachures et trames doivent garder la même finesse à tout zoom : construire les tracés en pixels (le projecteur le fait) et remplir avec un `CanvasPattern` défini en pixels écran.
- **Panneau caché** : sans taille, `ResizeObserver` ne se déclenche pas et `requestAnimationFrame` est suspendu. Le viewport fait un premier rendu synchrone ; pour vérifier, fixer une taille avec `resize_window`.
- **Tremblé du trait** : `makeProjector().pt(x, y, k, out)` avec `k = 0` pour des traits parfaitement réguliers (cyanotype), `k > 0` pour un tracé à la main.
- **Noms de rues** : le stage place les noms ; le style choisit lesquels selon le zoom dans `labels()` (moins de noms en vue d'ensemble), leur taille, puis dans `render()` leur couleur et la façon de les détacher du fond (halo, cartouche, aucun).
- **Bebas Neue n'a pas de minuscules** : une police en capitales affiche tout en capitales ; le texte accessible reste dans le HTML.
- **Index sur les tableaux plats** : `noUncheckedIndexedAccess` type `r[i]` en `number | undefined`. Dans une boucle bornée par la longueur, écrire `r[i]!` (comme `projection.ts`) ; pour un point ou un rectangle, utiliser les tuples `Point` et `Rect` de `geometry.ts`. `getContext('2d')` et `createPattern()` peuvent renvoyer `null` : passer par `context2d()` et `pattern()` de `canvas.ts`.
- **Le carré de données a des bords francs** : estomper (`frame.fade()` dans `render()`), recadrer ou encadrer, mais ne pas laisser voir la coupure brute des données.

## Données disponibles

Bâtiments, rues (type, nom, pont, tunnel), cours d'eau, plans d'eau, parcs et espaces verts. Rien d'autre (pas d'arbres isolés, de voies ferrées ni de hauteurs de bâtiments). Si un style en a vraiment besoin, il faut étendre `scripts/fetch-osm.ts`, ajouter la clé au type `MapData` de `src/data.ts` (et à `parseMapData`), et la documenter dans `src/styles/README.md`. Prévenir l'utilisateur, car il faudra retélécharger les lieux concernés.
