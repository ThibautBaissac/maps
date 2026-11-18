# France : enquêtes de L214

Ce dossier contient les données de la carte `france-dossier`. Le lieu `france` n'a pas de données OpenStreetMap (`basemap` dans `places/index.ts`). Son fond vient des couches de rôle `base`, qu'on convertit avec `npm run layers -- france`.

| Fichier | Contenu | Source et licence |
|---|---|---|
| `departements.geojson` | 96 départements métropolitains : `code`, `nom`, `region` (code INSEE de la région) | Tracés simplifiés IGN Admin Express COG 2018, via [france-geojson](https://github.com/gregoiredavid/france-geojson), Licence Ouverte. Codes de région tirés de [geo.api.gouv.fr](https://geo.api.gouv.fr/departements). |
| `fleuves.geojson` | Grands cours d'eau (Seine, Loire, Rhône, Garonne, Rhin, Dordogne…), noms en français | Natural Earth 1:10m *rivers and lake centerlines*, domaine public |
| `villes.geojson` | Les 13 chefs-lieux de région, au centre de leur commune | geo.api.gouv.fr, Licence Ouverte |
| `scripts/notion_table.py` | Transcription de la base des enquêtes de L214 : une ligne par enquête depuis 2008, avec ses sites | Base des enquêtes de L214 (Notion interne), consultée le 18 novembre 2026 |
| `registre.json` | Un enregistrement par site, communes géocodées | idem ; communes placées par geo.api.gouv.fr |
| `enquetes.geojson` | Les sites situés en France métropolitaine | tiré de `registre.json` |

Les enquêtes sans lieu sur la carte sont listées dans `places/investigations.ts`.

## Mise à jour

Depuis la racine du dépôt :

1. Reporter dans `scripts/notion_table.py` les enquêtes ajoutées ou corrigées dans la base de L214.
2. `python3 -I layers/france/scripts/notion-vers-registre.py` : géocode les communes et écrit `registre.json`.
3. `python3 -I layers/france/scripts/registre-vers-couches.py` : écrit `enquetes.geojson` et la liste de `places/investigations.ts`.
4. `npm run layers -- france`, puis `npm run vignettes -- france-dossier` avec le serveur de développement lancé.

## Transcription de la base

La base de L214 est interne. Le dépôt n'en garde que des faits déjà publics : titre, date de sortie, type de site, animaux, lieu, page publique de l'enquête.

Ne sont **pas** repris :
- les noms d'éleveurs, de gérants et d'exploitations (EARL, GAEC, SCEA) ;
- les liens internes : Drive, images brutes, vidéos non floutées ;
- les descriptions et les suites données.

**Lieu.** Il vient du champ « Lieu » de la fiche, ou du titre quand celui-ci nomme la commune (« Abattoir d'Alès »).
- Quand la fiche ne donne que le département, la commune est reprise de la page publique de l'enquête, si celle-ci la nomme. C'est le cas de Chantonnay, Montreuil-Bellay, Sabres, La Boissière-en-Gâtine, Branges, Chaleins et des huit communes de l'enquête E.Leclerc de 2025.
- Une enquête menée sur plusieurs sites situés séparément (« Sarthe et Finistère », « Pitgam & Esquelbecq ; Lespesses ») donne un enregistrement par site.

**Type de site.** Il suit le champ « Type » :
- `elevage` : élevage, foie gras, fourrure, pâturage, incendie ;
- `couvoir` : couvoir / broyage ;
- `autre` : expérimentation, pêche, grippe aviaire (enfouissement), charnier, kapparot, marché aux bestiaux ;
- `transport` : transport ;
- `abattoir` : abattoir.

**Communes.** Les communes fusionnées depuis portent leur nom actuel : Torfou → Sèvremoine, Missé → Thouars, Saint-Laurent-du-Mottay → Mauges-sur-Loire, La Boissière-de-Montaigu → Montaigu-Vendée, Boulazac → Boulazac Isle Manoire.

## Ce que la carte retient

- Seules les enquêtes publiées depuis 2008, année de création de L214, sont retenues : c'est la question de la carte. La base remonte à 2001.
- Les sites situés à la commune ont une marque. Ceux qui ne sont connus qu'au département ou à la région sont hachurés, placés au centre de leur zone pour la description.
- Une enquête sans lieu en France métropolitaine (plusieurs sites non nommés, outre-mer, étranger) est citée une fois dans la liste à part.
