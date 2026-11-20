---
name: new-map
description: Ajoute une carte qui explique une particularité d'un lieu, après validation de son sujet par l'utilisateur. Examine les données, recommande un sujet, puis réalise la carte dans le style demandé et vérifie son rendu. À utiliser pour une nouvelle carte, un quartier, une ville, un style ou une variante de couleurs (« fais-moi Lisbonne en gravure », « ajoute Kyoto », « je veux un style néon »).
argument-hint: "<lieu> <style ou description du style>"
---

# Nouvelle carte

Demande : $ARGUMENTS

Une carte associe un **lieu**, un **sujet validé**, une **voix** et un **style**, déclarés dans `src/registry.ts` et `voices/<id>.md`. Avant toute chose, lis `src/styles/README.md` (contrat d'un style, format des données, boîte à outils), `src/registry.ts` et `src/styles/index.ts` : ils décrivent l'état réel du projet, qui a pu évoluer depuis l'écriture de ce skill.

Chaque carte doit expliquer une particularité du lieu à travers un **sujet validé par l'utilisateur**. Le lieu et le style seuls ne suffisent pas à lancer sa réalisation.

## 1. Comprendre la demande

Extrais le lieu et le style. Le style tombe dans l'un de ces cas :

| Cas | Reconnaître | Travail |
|---|---|---|
| **Style codé** | clé présente dans `src/styles/index.ts` | ligne dans le registre (étape 3) |
| **Variante** | un style codé avec d'autres couleurs ou réglages couverts par son `defaults.ts` | ligne dans le registre avec `options` |
| **Preset non codé** | fichier dans `presets/` (dossier de ce skill) sans dossier `src/styles/<clé>/` | coder le style (étape 4) |
| **Description libre** | l'utilisateur décrit un style | l'enregistrer comme preset `presets/<clé>.md` (même en-tête que les autres), puis coder le style |

Hors validation du sujet, pose une question seulement si le choix change vraiment le résultat : quartier ambigu (deux quartiers du même nom), description à mi-chemin entre une variante et un nouveau style, clé de style à nommer. Sinon, applique les valeurs par défaut (zone de 2 km, titre du lieu et question du sujet validé dans l’en-tête) et dis-le dans ton compte rendu.

### Recommander le sujet et attendre sa validation

Avant de réaliser la carte :

1. Examine le lieu et les données disponibles. L'investigation peut consulter des sources et récupérer des données pour vérifier la faisabilité ; elle ne modifie pas encore le registre, le rendu ou les presets. Distingue les observations vérifiées, les hypothèses et les données à acquérir.
2. Présente un sujet recommandé sous forme de question précise, son intérêt pour comprendre le lieu, les données qui l'étayent, les éléments à mettre en évidence et ses limites. Signale ce qui demande des données supplémentaires. N'annonce pas de conclusion que les données ne démontrent pas.
3. Demande la validation du sujet et attends une réponse explicite avant de passer aux étapes de réalisation ci-dessous. L'accord sur un lieu, un style ou l'objectif « comprendre le lieu » ne valide pas un sujet précis. Un sujet demandé explicitement ou déjà validé dans la conversation ne demande pas de nouvelle confirmation.

Si l'utilisateur refuse le sujet, adapte la proposition. Si l'examen approfondi des données impose de changer de sujet, explique pourquoi et fais valider la nouvelle proposition avant de poursuivre.

### Définir la voix et attendre sa validation

Chaque carte raconte son sujet avec sa propre voix : un narrateur précis, accordé au sujet et au style. Une fois le sujet validé, et avant d'écrire le moindre texte :

1. Lis `references/voice.md` (dans ce skill) : ce que la voix couvre, le modèle de fiche, les interdits.
2. Rédige la fiche `voices/<id>.md` (`<id>` : l'id de la carte dans le registre) et présente-la avec deux ou trois phrases d'essai, en français, en anglais et en espagnol.
3. Attends une validation explicite. Une voix demandée explicitement ou déjà validée dans la conversation ne demande pas de nouvelle confirmation.

La voix ne s'applique qu'à la question et à l'introduction de la carte. Mesures, légende, méthode, limites et textes d'interface gardent le ton neutre du site.

### Réaliser le sujet validé

Le titre, la hiérarchie visuelle et les annotations doivent répondre à la question validée. Mets les éléments pertinents en évidence dès la vue générale et atténue les éléments de contexte. Explique les symboles dans la légende et fournis une description textuelle accessible du sujet et des observations, dans les langues du site.

Pour toute mesure, précise l'unité, le périmètre, la source, la date et la méthode. Ne confonds pas un nombre de segments OSM avec un nombre de rues, de ponts ou d'escaliers. Un signe graphique qui évoque une mesure, comme des courbes de niveau ou de profondeur, doit correspondre à des données réelles ; choisis autrement un traitement sans ambiguïté.

## 2. Le lieu

Si le lieu est déjà une clé de `places/index.ts`, réutilise-le. Sinon :

```bash
node .claude/skills/new-map/scripts/new-place.ts --city "<ville>" --district "<quartier>"
```

Le script interroge une fois Nominatim (OpenStreetMap) et ajoute le lieu à `places/index.ts` (il refuse un id déjà pris). Vérifie que les coordonnées trouvées tombent bien au centre du quartier voulu, pas sur une ville homonyme : le script affiche le lieu trouvé et les autres candidats. Si besoin, relance avec `--lat`/`--lon` (et `--size` pour une zone différente de 2 km).

Puis télécharge les données (couches OpenStreetMap écrites dans `public/data/<id>/osm.json`) :

```bash
npm run fetch-data -- <id>
```

Les serveurs Overpass publics sont souvent surchargés. Le script les essaie tous, deux tours de suite, avec une pause entre les deux (jusqu'à une dizaine de minutes en cas d'échec) : lance-le en arrière-plan. S'il échoue quand même, relance-le une fois quelques minutes plus tard. Si ce second essai échoue aussi, arrête-toi et explique le problème à l'utilisateur plutôt que d'inventer des données. Au-delà d'environ 8 Mo de JSON, propose une zone plus petite : le chargement de la page en souffrirait.

Vérifie ensuite que les données contiennent ce qu'on voit sur openstreetmap.org autour du lieu, surtout l'eau : mer, estuaire, fleuve, lac. Le script reconstitue la mer à partir du littoral (`natural=coastline`). Si une étendue d'eau visible sur OSM manque dans la couche `water`, c'est un manque de la conversion à corriger dans `scripts/osm.ts` (requête Overpass et règles de classement, avec un test dans `tests/osm.test.ts`), et à documenter dans `src/styles/README.md`, avant de dessiner. Si la correction ne touche que les règles de classement (pas la requête), vérifie-la sans retélécharger : `npm run fetch-data -- <lieu> --offline`.

### Couches extérieures (facultatif)

OSM ne contient pas tout. Si le sujet validé repose sur des objets qu'OSM n'a pas (équipements recensés par une ville, tracé historique, relevé d'une association), propose une **couche extérieure** : un fichier GeoJSON ajouté à la carte, sans toucher aux données OSM. Ne la propose que si la source est ouverte et son usage libre, et dis à l'utilisateur d'où elle vient avant de l'utiliser.

1. **Ranger la source** dans `layers/<lieu>/<id>.geojson` (versionnée, en WGS84). `<id>` est un identifiant `a-z0-9-` ; `osm` est réservé.
2. **La déclarer** dans `places/layers.ts`, sous l'id du lieu : `title` (texte ou `{ fr, en, es, pt, de }`, affiché dans la description), `file`, `kind` (`points`, `lines` ou `areas`), `role` (`overlay`, dessinée par-dessus la carte), `nameField` et `categoryField` si la source en a.
3. **Créditer** dans `attribution` (obligatoire, non vide) : l'auteur et la licence de la source, par exemple `© Ville d’Amsterdam, CC BY 4.0`. La page l'affiche à la suite du crédit OSM (ODbL, déjà présent) ; ne l'invente pas, relève-la sur la page du jeu de données. Sans licence claire, n'utilise pas la source. Un crédit qui contient des mots à traduire (« numérisé pour ce site ») s'écrit `{ fr, en, es, pt, de }` ; le fichier converti garde le texte français.
4. **Convertir** : `npm run layers -- <lieu>` écrit `public/data/<lieu>/<id>.json` en mètres locaux ; committe ce fichier avec la source.
5. **L'attacher à la carte** : `layers: ['<id>']` dans l'entrée de `src/registry.ts`. Le build refuse un id inconnu, un fichier absent ou converti pour un autre carré.

Un style Canvas dessine ces couches avec `drawLayers()` (voir `src/styles/README.md`) ; vérifie à l'œil qu'elles se lisent à côté du sujet. La description accessible en liste déjà les objets nommés, dans une section par couche.

## 3. Le registre

Ajoute l'entrée dans `src/registry.ts` :

```ts
{ id: 'lisbonne-cyanotype', place: 'lisbonne-alfama', style: 'cyanotype', topic: 'steps', options: { /* si variante */ } },
```

Réutilise un sujet de `TOPICS` (`src/topics/index.ts`) seulement s’il correspond à la question validée. Sinon, crée `src/topics/<id>/` : `evidence.ts` pour la sélection et les mesures pures, `messages.ts` pour ses textes dans les cinq langues, et `index.ts` qui exporte `messages` et `topic`, un `TopicDef` (`src/topics/types.ts`) : `analyse()` qui ajoute les repères numérotés, `content()` pour le texte du panneau, qui lit `MESSAGES[locale]`, et, si les styles Canvas doivent le tracer, `draw()` (dans `draw.ts`, avec les couleurs `TopicInk` que chaque style lui passe) et `badges: 'on'` pour un sujet linéaire dont les numéros peuvent se poser sur le trait. Enregistre-le dans `TOPICS` (`src/topics/index.ts`) avec ses thèmes (trouvés par la recherche de la galerie ; un nouveau thème va dans `THEME_IDS` et dans `themes.<thème>` des dictionnaires) et `load: () => import('./<id>/index.ts')`, puis dans `MODULES` de `src/topics/all.ts`, et ajoute ses vérifications. Un style qui dessine les textes du sujet importe son `messages.ts`. Un sujet mesuré en longueur de tronçons réutilise `linearTopic()` de `src/topics/linear/`. Le build refuse une carte sans sujet ou avec un sujet inconnu.

Les textes d'une carte sont de deux sortes :
- les textes du sujet, dans `src/topics/<sujet>/messages.ts` (les cinq langues dans un seul fichier) : `metric`, `legend`, `method`, `limits`, les faits et la méthode du sujet, au ton neutre, partagés par toutes les cartes de ce sujet, puis les textes propres au sujet (panneau, légende dessinée, description) ;
- `maps.<id>`, dans `src/i18n/maps/<id>.ts` (les cinq langues dans un seul fichier, à enregistrer dans `STORIES` de `src/i18n/stories.ts`) : `question` et `intro`, écrites dans la voix de la carte selon `voices/<id>.md`. Chaque carte du registre doit avoir les siennes : `tsc -b` refuse une entrée manquante ou en trop. Le build les écrit dans la page de la carte, qui ne charge rien d’autre.

L'`id` donne l'URL de la page (`/cartes/<id>/`) : court et lisible. Par défaut `<ville>-<style>`. Si la ville a déjà une carte dans ce style, prends `<ville>-<quartier>-<style>`, et pour une variante ajoute un mot qui la distingue (`amsterdam-riso-vert`). Une demande explicite de l'utilisateur l'emporte.

`npm run build` vérifie strictement le registre : d'abord les types (`tsc -b` : lieu présent dans `places/index.ts`, clé de style connue, `options` conformes au `defaults.ts` du style), puis les données (`src/catalogue.ts`) : présentes, et toujours d'accord avec le lieu (nom, quartier, coordonnées, taille). Si tu modifies un lieu, relance `npm run fetch-data -- <lieu>` ; pour un simple changement de nom ou de quartier, `npm run fetch-data -- <lieu> --offline` suffit (il reconvertit la réponse gardée en cache, sans réseau). En développement, une entrée en défaut est seulement ignorée avec un avertissement dans la console du serveur, et sa page apparaît d'elle-même dès que les données sont là.

## 4. Coder un nouveau style

Lis d'abord `references/new-style.md` (dans ce skill) : méthode, pièges déjà rencontrés, budgets de performance. En résumé :
- dossier `src/styles/<clé>/` avec `index.ts` (`mount`, typé par `src/styles/contract.ts`), `defaults.ts` (interface des options et valeurs par défaut : couleurs, épaisseurs, polices) et `SPEC.md` (copie du preset, pour que la spécification vive avec le code) ;
- déclaration dans `src/styles/index.ts` : interface d'options dans `StyleOptions`, puis libellé, `load`, `card` dans `STYLES` ;
- le projet est en TypeScript strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`…) : `npm run typecheck` doit passer, sans `any` ni `@ts-ignore` ;
- polices OFL téléchargées dans `public/fonts/<famille>/` avec leur `OFL.txt`, chargées avec `loadFont()`.

Le preset décrit l'intention. Traite chacune de ses lignes comme un point à vérifier, mais interprète-les en illustrateur : si une consigne rend la carte illisible ou trop lente, adapte-la et signale l'écart.

## 5. Vérifier

Le style se juge à l'œil. Une carte qui compile mais qu'on n'a pas regardée n'est pas finie.

1. Lance le serveur de développement avec `preview_start` (configuration `vite` de `.claude/launch.json`), puis ouvre `http://localhost:5173/maps/cartes/<id>/`. Si le port 5173 est déjà pris, un serveur tourne déjà pour ce dossier (une autre session, par exemple) : ouvre simplement l'URL dans le navigateur intégré. Si l'URL renvoie la galerie ou une erreur 404, lis la console du serveur : l'avertissement `[registry] skipped` en donne la raison.
2. Si le panneau Browser est caché, la page mesure 0 × 0 et ne dessine rien. Fixe une taille avec `resize_window` (par exemple 1280 × 800) et recharge.
3. Prends des captures à **trois niveaux de zoom** : vue d'ensemble, environ 1 px/m, environ 4 px/m. En développement, `window.__map` expose la poignée renvoyée par `mount` : pour un style construit sur le viewport, fixe la vue avec `Object.assign(window.__map.viewport.view, { x: 0, y: 0, s: 1 })` puis force le rendu net avec `window.__map.full()` (ou zoome comme les boutons avec `window.__map.viewport.zoom(1.5)`).
4. Teste aussi la largeur téléphone (`resize_window` avec le preset `mobile`), une vraie molette et un vrai glisser.
5. Contrôle :
   - question validée compréhensible dès la vue générale ; annotations et mesures justifiées par les données, sources et limites consultables ;
   - sujet et observations disponibles en texte ; information compréhensible sans dépendre de la couleur seule ;
   - question et introduction fidèles à `voices/<id>.md` dans les cinq langues, sans fait ni chiffre absent des données, de la méthode ou des sources citées ;
   - console sans erreur ;
   - aucune requête externe : `performance.getEntriesByType('resource')` ne doit contenir que l'origine locale ;
   - lien retour et attribution OSM visibles et lisibles ;
   - noms de rues sans chevauchement ;
   - chaque ligne du preset respectée, ou l'écart justifié ;
   - rendu net assez rapide : voir les budgets et la façon de mesurer dans `references/new-style.md`. Un chronomètre autour du seul appel de rendu ne mesure pas le dessin réel.
6. Corrige, puis reprends des captures. Recommence jusqu'à un résultat dont tu serais fier en affiche.
7. Prends l'image de la galerie : `npm run vignettes -- <id>` (le serveur de développement doit tourner ; ajoute `--base http://localhost:<port>/maps/` s'il n'est pas sur 5173). Ouvre `public/vignettes/<langue>/<id>.webp` et `<id>.jpg` (l'aperçu d'un lien partagé) : les deux cadrages doivent montrer le cœur du quartier. Refais-la après toute retouche du style.
8. `npm run build` (types compris) doit passer, sans avertissement d'image manquante. Vérifie aussi la bande de la carte dans la galerie (`/maps/`), au survol et en largeur téléphone.

À la fin, rends au viewport sa taille normale (`resize_window` avec le preset `desktop`).

## 6. Commiter

- Si un style a été créé : un commit pour le style, puis un commit pour la carte (image de la galerie comprise).
- Messages en anglais, à l'impératif, avec la ligne d'attribution demandée par la session.
- **Ne pousse pas** sans demande explicite : un push sur `main` publie le site public.

## Garde-fous

- Le style s'inspire d'un genre, jamais d'une œuvre précise (affiche, plan ou illustration existants).
- Les pages ne contactent aucun serveur externe. Les données et les polices sont servies par le site lui-même.
- Si tu modifies la boîte à outils (`src/toolkit/`), les styles existants doivent continuer de fonctionner : revérifie au moins une carte riso par capture.
- Si `src/styles/README.md` contredit ce skill, c'est le README qui fait foi : il suit le code.

## Compte rendu

Termine par quelques lignes :
- sujet validé et ce que la carte permet de comprendre ;
- voix retenue, en une phrase ;
- URL locale de la carte ;
- ce qui a été créé (lieu, données, style, registre) ;
- écarts par rapport au preset et leur raison ;
- ce qui reste imparfait.
