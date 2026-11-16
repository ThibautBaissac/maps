# Comprendre les particularités d’un lieu

## Problem statement

Les plans montrent la géographie de quartiers sans expliquer une particularité du lieu. Le visiteur doit pouvoir identifier le sujet, repérer ses éléments et comprendre les observations et leurs limites.

## Solution

L’utilisateur a validé les sujets « Où franchit-on les canaux du centre historique ? » pour Amsterdam et « Où se concentrent les escaliers du quartier ? » pour Alfama. Les deux cartes conservent leur style et rendent les éléments du sujet visibles dès la vue générale. Un contenu textuel traduit présente le sujet, des mesures, des repères nommés, la légende, la source et les limites.

## User stories

1. Comme visiteur, je veux connaître le sujet avant d’explorer la carte.
2. Comme visiteur, je veux distinguer les éléments étudiés du contexte dès la vue générale.
3. Comme visiteur, je veux retrouver des repères nommés sur le dessin et dans son explication.
4. Comme visiteur, je veux observer la répartition des éléments avec des mesures dont je comprends l’unité et le périmètre.
5. Comme visiteur, je veux connaître la source, la date et les limites des observations.
6. Comme visiteur au clavier ou avec un lecteur d’écran, je veux consulter les informations et retrouver les repères.
7. Comme visiteur francophone, anglophone ou hispanophone, je veux lire le même contenu dans ma langue.
8. Comme auteur, je veux que l’agent attende ma validation du sujet avant de réaliser une carte.

## Implementation decisions

- Le registre exige un sujet pour chaque carte. Le catalogue refuse un sujet absent ou inconnu et transmet le sujet aux pages et aux styles sans changer les titres des lieux ni les URL.
- Un module pur analyse les données : sélection des tronçons, découpage au carré étudié, longueurs en mètres, répartition en neuf secteurs et repères nommés. Le dessin et le texte consomment le même résultat.
- Amsterdam : retenir les voies marquées comme pont qui croisent l’axe d’un canal de surface dans le carré. Ne pas annoncer un nombre de ponts physiques. Les noms de voies peuvent correspondre à plusieurs tronçons et passages.
- Alfama : retenir les voies de catégorie escalier dans le carré. Ne pas assimiler les longueurs à des dénivelés ni les tronçons à un nombre d’escaliers ou de marches.
- Les mesures décrivent la zone carrée du relevé, qui peut dépasser les limites administratives du quartier. Les longueurs additionnent les géométries cartographiées, y compris des voies parallèles.
- Les repères numérotés identifient des voies nommées présentes dans les données ; leurs positions restent sur les géométries retenues. Ils disposent d’un équivalent textuel et d’une commande au clavier pour les retrouver.
- Le contenu explicatif occupe une zone distincte du dessin ; sur petit écran, la page défile sans masquer les commandes.
- Les lignes décoratives qui peuvent évoquer une profondeur mesurée sont remplacées par une représentation de l’eau sans indication de profondeur.

## Testing decisions

- Vérifier les sélections et mesures au niveau du module d’analyse avec des géométries simples : découpage aux limites, passages au-dessus des canaux, exclusions des tunnels et ponts sans canal, noms regroupés et répartition spatiale.
- Vérifier la présence du sujet dans les pages HTML et les traductions.
- Vérifier le rendu réel des deux cartes sur ordinateur et téléphone, puis les commandes au clavier, les repères et les descriptions.
- Exécuter la suite existante et la construction. Régénérer les vignettes des trois langues après le contrôle du rendu.

## Global constraints

- Conserver TypeScript strict et Node ≥ 24 ; aucune dépendance de production supplémentaire.
- Servir données et polices localement, sans requête externe à la consultation.
- Conserver les liens existants, les trois langues, le zoom et le déplacement.
- Fournir l’information en texte et sans dépendance à la couleur seule.
- Fonder annotations et mesures sur les données ; ne pas inventer de faits historiques.
- Attendre la validation explicite d’un nouveau sujet ; les deux sujets ci-dessus sont validés.

## Out of scope

- Calcul d’itinéraires et garantie d’accessibilité des parcours.
- Altimétrie, nombre de marches et profondeur de l’eau.
- Décompte de ponts physiques à partir des segments OSM.
- Publication ou push.

## Further notes

La compétence de création de cartes contient déjà la validation obligatoire du sujet. Les choix techniques détaillent ici la réalisation autorisée par l’utilisateur.
