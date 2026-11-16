# Décisions prises pendant le build (spec : 2026-11-16-osm-conversion.md)

Points où le spec ne tranchait pas, ou admettait deux lectures.

1. **Le module exporte les types de la réponse Overpass** (`OverpassAnswer`, `OsmElement`, `OsmTags`…). C'est ce que veut dire « passent dans le module » : le script de téléchargement a besoin de `OverpassAnswer` pour typer son retour.
2. **Le module exporte aussi `QUERY_TIMEOUT_S`.** Le spec dit que le script l'utilise pour son délai d'abandon d'un serveur : il faut donc que la constante soit exportée.
3. **Le carré du lieu (`half`, `bbox`) est calculé par une fonction interne (`survey`),** partagée par la requête et la conversion.
4. **Les fixtures des tests sont construites en mètres,** avec un petit helper qui les convertit en latitude/longitude grâce aux constantes de la projection. Les assertions, elles, ne refont pas ce calcul, pour que les tests ne soient pas tautologiques : elles portent sur des mètres écrits en dur (test 1), des surfaces, des comptes, ou la structure des anneaux.
5. **Vérification d'équivalence faite.** Un serveur Overpass a répondu ; la réponse brute d'Amsterdam fait 15,8 Mo. L'ancien script (`main`) et le nouveau, rejouant tous deux cette réponse, écrivent des fichiers identiques octet pour octet (2 001 676 octets), `fetchedAt` mis de côté. Les journaux de console sont identiques, à la ligne « Saved » près, qui contient le chemin du fichier.

## Après la revue de code

6. **La doc des anneaux du spec était fausse, et c'est la doc qui a été corrigée.** Le spec affirmait que tous les anneaux téléchargés répètent leur premier point. C'est vrai pour Amsterdam, la seule ville que j'avais vérifiée pendant la conception. À Lisbonne, un anneau de mer sur 16 ne se referme pas : `seaPolygons` ne remet jamais le premier point à la fin, son carré de repli non plus, et une relation incomplète garde son anneau ouvert. Fermer ces anneaux dans le code aurait changé `public/data`, ce que le spec interdit. La doc (`src/data.ts`, `src/styles/README.md`) dit maintenant : « répété pour les chemins OSM, pas forcément pour la mer ni pour les relations incomplètes ; fermer le tracé soi-même ».
7. **La fixture couvre aussi les règles « no » et les cas laissés de côté.** Elle contient maintenant `building=no`, `bridge=no`, `tunnel=no`, un cours d'eau en tunnel (`culvert`), `waterway=dam`, un `highway` inconnu, `landuse=basin`, des parcs `garden`/`grass`/`wood`, et un parc qui porte `leisure` et `landuse` (priorité des tags). La revue a trouvé 9 casses non détectées ; je les ai rejouées après les ajouts, et chacune fait maintenant tomber au moins un test.
8. **Les tests comparent le `meta` et les routes en JSON,** pour fixer l'ordre des clés du fichier en plus de leurs valeurs. Le test de la requête compare le texte complet.
9. **Changements mineurs dans le code :**
   - un helper `isSet` pour « présent et différent de `no` » ;
   - le retour de la garde de type `isOverpassAnswer`, à la place d'un double cast ;
   - seul `OverpassAnswer` est exporté parmi les types de la réponse.
10. **Laissé tel quel après la revue :**
    - le helper de surface des tests reste dupliqué entre les deux fichiers de test (quelques lignes) ;
    - une réponse qui contient à la fois des éléments et une `remark` reste acceptée, comme avant (comportement existant, hors spec) ;
    - l'asymétrie `overpassQuery(place)` / `convertOsm(…, placeId, …)` vient du spec.
