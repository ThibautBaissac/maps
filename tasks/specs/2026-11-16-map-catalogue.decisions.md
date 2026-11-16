# Décisions prises pendant le build (spec : 2026-11-16-map-catalogue.md)

Points où le spec ne tranchait pas, ou admettait deux lectures.

1. **L'index des lieux exporte aussi `isPlaceId(id)`.** Le script de téléchargement reçoit un id en ligne de commande. Il lui faut une garde de type pour passer d'un `string` à un `PlaceId` avant de lire `PLACES[id]`.
2. **La génération des pages est devenue synchrone.** Sans import dynamique des lieux, plus rien n'y est asynchrone. La fonction de configuration Vite n'est donc plus `async`.
3. **Le script des vignettes écrit à `public/` + `paths.vignette`, et crée le dossier de ce chemin.** Avant, il créait `public/vignettes/` en dur.
4. **Le script de création de lieu valide l'entrée deux fois.** Avant d'écrire, il passe les arguments par `parsePlace`. Après l'écriture, il réimporte l'index et repasse l'entrée par `parsePlace`, pour vérifier le fichier tel que le site le lira. Le spec ne demandait que la première validation ; la seconde vient de la discussion de conception.
5. **La page de carte retire `name` avec un petit helper (`withoutName`).** Ce helper renvoie un objet qui n'a plus la clé `name` du tout. Un simple `{ ...data.meta, title }` aurait compilé (les spreads ne sont pas soumis au contrôle des propriétés en trop), mais `name` serait arrivé jusqu'au style à l'exécution.
6. **Le journal de développement de la page de carte (`console.log`) garde `data.meta.name`.** Il décrit les données téléchargées, pas la carte affichée.

## Après la revue de code

7. **`dataPath` vit dans l'index des lieux, plus dans le catalogue.** C'est un écart au spec. Le script de téléchargement importait tout le catalogue (registre et styles) juste pour ce chemin, si bien qu'une entrée de registre cassée pour un lieu B empêchait de télécharger un lieu A. Le chemin des données dépend du lieu seul : l'index est sa place.
8. **Le catalogue contrôle aussi le lieu et le style d'une entrée, au-delà de la liste du spec.** Node et Vite retirent les types à l'exécution, donc une entrée que le typecheck refuserait peut quand même arriver jusqu'au catalogue. Elle donne maintenant un problème (« unknown place » ou « unknown style », avec les valeurs connues) au lieu d'un `TypeError` à l'import. `catalogueOf` laisse ces entrées de côté, et `isStyleKey` retrouve un appelant.
9. **Un fichier de données illisible (JSON invalide, téléchargement interrompu) est un problème qui nomme le fichier.** Pour le distinguer d'un fichier absent (`undefined`), le lecteur de Vite renvoie `null` dans ce cas.
10. **Le catalogue exporte le dossier des pages (`PAGES_DIR`).** La config Vite l'utilise pour vider ce dossier avant de régénérer les pages : le préfixe des pages n'est donc écrit qu'à un seul endroit.
11. **Le script de création de lieu écrit ses chaînes avec `JSON.stringify`.** Les retours à la ligne, guillemets et antislashs sont ainsi échappés. Conséquence visible : les nouvelles entrées de l'index ont des guillemets doubles, alors que les deux entrées existantes ont des guillemets simples. Si l'entrée relue ne passe pas, le script remet l'index tel qu'il était avant d'échouer.
12. **En développement, deux entrées avec le même id sont toutes deux ignorées.** `main` gardait la première. Un id en double est une erreur de build de toute façon. Ignorer les deux évite de publier, en développement, une page que le build refuserait.
13. **Laissé tel quel après la revue :**
    - le test de mount retire `name` à la main, sans réutiliser le helper de la page (un helper exporté pour une seule ligne de test n'apporterait rien) ;
    - le lecteur JSON du test et celui de Vite restent séparés (l'un tourne sur les fixtures du test, l'autre fait partie de la config de build) ;
    - les entrées de test gardent leur `as MapEntry`, qui permet de construire volontairement des entrées invalides.
