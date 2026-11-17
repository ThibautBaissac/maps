# Filtres de la galerie : ville, style et thème

## Problem statement

La galerie montre toutes les cartes côte à côte. Rien ne permet de ne garder que les cartes d'une ville, d'un style ou d'un thème (l'eau, le relief, l'histoire…). À mesure que le registre grandit, les bandes deviennent étroites et le visiteur ne peut plus chercher par intérêt.

## Solution

Une rangée de filtres (des « chips ») sous l'en-tête de la galerie. Un seul filtre est actif à la fois, ou aucun (« Toutes »). Les filtres viennent de trois facettes :

- **Ville** : le lieu de la carte (`place`), libellé par le nom traduit du lieu.
- **Style** : le style de la carte (`style`), libellé par le nom traduit du style.
- **Thème** : les thèmes du sujet de la carte. Ils sont déclarés une seule fois par sujet dans `src/topics.ts` (`TOPIC_THEMES`), et leurs libellés vivent dans les dictionnaires (`themes.<id>`).

Un filtre n'apparaît que s'il trie vraiment : il doit retenir au moins une carte, sans les retenir toutes. Une facette sans filtre utile n'apparaît pas. Sans filtre utile du tout, la rangée n'est pas rendue.

## User stories

1. En tant que visiteur, je veux cliquer sur un thème, une ville ou un style pour ne garder que les cartes qui lui correspondent, et cliquer sur « Toutes » pour les retrouver toutes.
2. En tant que visiteur au clavier ou avec un lecteur d'écran, je veux des boutons atteignables avec Tab, dont l'état est annoncé (`aria-pressed`), et un message qui annonce le nombre de cartes affichées.
3. En tant que visiteur, je veux qu'une adresse comme `?tag=theme:water` ouvre la galerie déjà filtrée, pour partager une sélection, et que le filtre soit conservé quand je reviens d'une carte.
4. En tant que visiteur sans JavaScript, je veux voir toutes les cartes, sans boutons qui ne feraient rien.
5. En tant que visiteur sur mobile, je veux que les filtres passent à la ligne au lieu de déborder.
6. En tant que mainteneur, je veux qu'un sujet sans thèmes, ou un thème sans traduction, soit refusé par le typecheck ou par le build.

## Implementation decisions

- **Identifiants des filtres** : `<facette>:<valeur>`, par exemple `place:londres-soho`, `style:riso` ou `theme:water`. Le préfixe évite les collisions entre facettes.
- **Module pur** `src/gallery/filters.ts`, utilisable sous Node et dans le navigateur :
  - `mapTags(map)` : les tags d'une carte résolue ;
  - `galleryFilters(maps, locale)` : les facettes et leurs filtres utiles, chacun avec son libellé et son nombre de cartes ;
  - `isShown(tags, selected)` : vrai si la carte est visible pour ce filtre.
- **HTML statique** (`scripts/pages.ts`) :
  - chaque `<li class="strip">` porte `data-tags` ;
  - la rangée de filtres est rendue avec l'attribut `hidden`, et `main.ts` la révèle au chargement (amélioration progressive).
- **Script** `src/gallery/main.ts` :
  - lit `?tag=` au chargement, et ignore une valeur inconnue ;
  - masque les bandes avec `hidden` ;
  - met à jour `aria-pressed` et le compteur ;
  - réécrit l'URL avec `history.replaceState`.
- **Mise en page** : une bande seule ne dépasse pas une largeur raisonnable, pour éviter une bande qui occupe tout l'écran.
- **Le skill `new-map`** demande de déclarer les thèmes de tout nouveau sujet.

## Out of scope

- Combiner plusieurs filtres (ET / OU).
- Une page statique par tag.
- Des tags propres à une carte, différents de ceux de son sujet.
