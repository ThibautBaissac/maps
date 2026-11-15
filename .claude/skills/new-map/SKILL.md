---
name: new-map
description: Ajoute une nouvelle carte au site de cartes illustrées à partir d'un lieu (ville, quartier ou coordonnées) et d'un style (style déjà codé, preset du catalogue, ou description libre). Crée le fichier du lieu, télécharge les données OpenStreetMap, ajoute la carte au registre, code le style s'il n'existe pas encore, vérifie le rendu par captures et commite. À utiliser dès que l'utilisateur veut une nouvelle carte, un nouveau quartier ou une nouvelle ville, un nouveau style graphique ou une variante de couleurs, même s'il ne nomme pas le skill (« fais-moi Lisbonne en gravure », « ajoute Kyoto », « je veux un style néon »).
argument-hint: "<lieu> <style ou description du style>"
---

# Nouvelle carte

Demande : $ARGUMENTS

Une carte = un **lieu** (`places/<lieu>.ts` + `public/data/<lieu>.json`) × un **style** (`src/styles/<style>/`), déclarée dans `src/registry.ts`. Avant toute chose, lis `src/styles/README.md` (contrat d'un style, format des données, boîte à outils), `src/registry.ts` et `src/styles/index.ts` : ils décrivent l'état réel du projet, qui a pu évoluer depuis l'écriture de ce skill.

## 1. Comprendre la demande

Extrais le lieu et le style. Le style tombe dans l'un de ces cas :

| Cas | Reconnaître | Travail |
|---|---|---|
| **Style codé** | clé présente dans `src/styles/index.ts` | ligne dans le registre (étape 3) |
| **Variante** | un style codé avec d'autres couleurs ou réglages couverts par son `defaults.ts` | ligne dans le registre avec `options` |
| **Preset non codé** | fichier dans `presets/` (dossier de ce skill) sans dossier `src/styles/<clé>/` | coder le style (étape 4) |
| **Description libre** | l'utilisateur décrit un style | l'enregistrer comme preset `presets/<clé>.md` (même en-tête que les autres), puis coder le style |

Pose une question seulement si le choix change vraiment le résultat : quartier ambigu (deux quartiers du même nom), description à mi-chemin entre une variante et un nouveau style, clé de style à nommer. Sinon, applique les valeurs par défaut (zone de 2 km, titre = nom de la ville) et dis-le dans ton compte rendu.

## 2. Le lieu

Si `places/<id>.ts` existe déjà, réutilise-le. Sinon :

```bash
node .claude/skills/new-map/scripts/new-place.ts --city "<ville>" --district "<quartier>"
```

Le script interroge une fois Nominatim (OpenStreetMap) et écrit `places/<id>.ts`. Vérifie que les coordonnées trouvées tombent bien au centre du quartier voulu, pas sur une ville homonyme : le script affiche le lieu trouvé et les autres candidats. Si besoin, relance avec `--lat`/`--lon` (et `--size` pour une zone différente de 2 km).

Puis télécharge les données :

```bash
npm run fetch-data -- <id>
```

Les serveurs Overpass publics sont souvent surchargés. Le script les essaie tous, deux tours de suite, avec une pause entre les deux (jusqu'à une dizaine de minutes en cas d'échec) : lance-le en arrière-plan. S'il échoue quand même, relance-le une fois quelques minutes plus tard. Si ce second essai échoue aussi, arrête-toi et explique le problème à l'utilisateur plutôt que d'inventer des données. Au-delà d'environ 8 Mo de JSON, propose une zone plus petite : le chargement de la page en souffrirait.

Vérifie ensuite que les données contiennent ce qu'on voit sur openstreetmap.org autour du lieu, surtout l'eau : mer, estuaire, fleuve, lac. Le script reconstitue la mer à partir du littoral (`natural=coastline`). Si une étendue d'eau visible sur OSM manque dans `water`, c'est un manque du script à corriger dans `scripts/fetch-osm.ts`, et à documenter dans `src/styles/README.md`, avant de dessiner.

## 3. Le registre

Ajoute l'entrée dans `src/registry.ts` :

```ts
{ id: 'lisbonne-cyanotype', place: 'lisbonne-alfama', style: 'cyanotype', options: { /* si variante */ } },
```

L'`id` donne l'URL de la page (`/cartes/<id>/`) : court et lisible. Par défaut `<ville>-<style>`. Si la ville a déjà une carte dans ce style, prends `<ville>-<quartier>-<style>`, et pour une variante ajoute un mot qui la distingue (`amsterdam-riso-vert`). Une demande explicite de l'utilisateur l'emporte.

`npm run build` vérifie strictement le registre : d'abord les types (`tsc -b` : clé de style connue, `options` conformes au `defaults.ts` du style), puis la présence du lieu et des données. En développement, une entrée incomplète est seulement ignorée avec un avertissement dans la console du serveur, et sa page apparaît d'elle-même dès que le lieu et les données existent.

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
3. Prends des captures à **trois niveaux de zoom** : vue d'ensemble, environ 1 px/m, environ 4 px/m. En développement, `window.__map` expose la poignée renvoyée par `mount` : pour un style construit sur le viewport, utilise `window.__map.viewport.setView({ x, y, s })`.
4. Teste aussi la largeur téléphone (`resize_window` avec le preset `mobile`), une vraie molette et un vrai glisser.
5. Contrôle :
   - console sans erreur ;
   - aucune requête externe : `performance.getEntriesByType('resource')` ne doit contenir que l'origine locale ;
   - lien retour et attribution OSM visibles et lisibles ;
   - noms de rues sans chevauchement ;
   - chaque ligne du preset respectée, ou l'écart justifié ;
   - rendu net assez rapide : voir les budgets et la façon de mesurer dans `references/new-style.md`. Un chronomètre autour du seul appel de rendu ne mesure pas le dessin réel.
6. Corrige, puis reprends des captures. Recommence jusqu'à un résultat dont tu serais fier en affiche.
7. `npm run build` (types compris) doit passer. Vérifie aussi la carte de la galerie (`/maps/`).

À la fin, rends au viewport sa taille normale (`resize_window` avec le preset `desktop`).

## 6. Commiter

- Si un style a été créé : un commit pour le style, puis un commit pour la carte.
- Messages en anglais, à l'impératif, avec la ligne d'attribution demandée par la session.
- **Ne pousse pas** sans demande explicite : un push sur `main` publie le site public.

## Garde-fous

- Le style s'inspire d'un genre, jamais d'une œuvre précise (affiche, plan ou illustration existants).
- Les pages ne contactent aucun serveur externe. Les données et les polices sont servies par le site lui-même.
- Si tu modifies la boîte à outils (`src/toolkit/`), les styles existants doivent continuer de fonctionner : revérifie au moins une carte riso par capture.
- Si `src/styles/README.md` contredit ce skill, c'est le README qui fait foi : il suit le code.

## Compte rendu

Termine par quelques lignes :
- URL locale de la carte ;
- ce qui a été créé (lieu, données, style, registre) ;
- écarts par rapport au preset et leur raison ;
- ce qui reste imparfait.
