# France : enquêtes de L214

Ce dossier contient les données de la carte `france-dossier`. Le lieu `france` n'a pas de données OpenStreetMap (`basemap` dans `places/index.ts`). Son fond vient des couches de rôle `base`, qu'on convertit avec `npm run layers -- france`.

| Fichier | Contenu | Source et licence |
|---|---|---|
| `departements.geojson` | 96 départements métropolitains : `code`, `nom`, `region` (code INSEE de la région) | Tracés simplifiés IGN Admin Express COG 2018, via [france-geojson](https://github.com/gregoiredavid/france-geojson), Licence Ouverte. Codes de région tirés de [geo.api.gouv.fr](https://geo.api.gouv.fr/departements). |
| `fleuves.geojson` | Grands cours d'eau (Seine, Loire, Rhône, Garonne, Rhin, Dordogne…), noms en français | Natural Earth 1:10m *rivers and lake centerlines*, domaine public |
| `villes.geojson` | Les 13 chefs-lieux de région, au centre de leur commune | geo.api.gouv.fr, Licence Ouverte |
| `registre.json` | Le relevé complet des enquêtes, avec citation et doutes | Relevé pour ce site d'après l214.com, le 18 novembre 2026 |
| `enquetes.geojson` | Les enquêtes situées en France métropolitaine, tirées du relevé | idem ; communes placées par geo.api.gouv.fr |

Les enquêtes sans lieu sur la carte sont listées dans `places/investigations.ts`.

Toutes les sources ont été téléchargées le 18 novembre 2026.

## Le relevé (`registre.json`)

1. **Inventaire.** Le relevé part de la liste [l214.com/enquetes](https://www.l214.com/enquetes/), puis des sitemaps du site et des pages de campagne. Ces deux dernières sources ajoutent des enquêtes absentes de la liste. Les pages annuelles `/enquetes/<année>/` n'existent pas : elles redirigent vers la vidéothèque.
2. **Regroupement.** Les adresses d'une même enquête comptent une seule fois : enquête commentée par une personnalité, nouvelles images, ancienne adresse republiée en 2026. Le champ `urls` les garde toutes. Le relevé écarte 24 pages (champ `excluded`, avec le motif) : articles explicatifs, pétitions seules, enquêtes d'autres associations.
3. **Lieu.** Le lieu vient de la page de l'enquête, ou à défaut du texte de la liste, jamais du siège de l'entreprise citée.
   - `precision` vaut `commune` quand la page nomme la commune du site, `departement` ou `region` quand elle ne donne que cela.
   - Elle vaut `none` sans lieu en France (transport, mer, sites non nommés), `outremer` ou `etranger` selon le cas.
   - `evidence` cite la phrase qui situe l'enquête (15 mots au plus), vérifiée mot pour mot. `notes` consigne les doutes.
4. **Sites multiples.** Une enquête menée sur plusieurs sites situés séparément donne un enregistrement par site, avec un même `group`.
5. **Géocodage.** Les communes sont placées au centre donné par `https://geo.api.gouv.fr/communes`, filtré par département. L'API confirme aussi les codes INSEE de la commune, du département et de la région.

Le relevé compte 187 enregistrements, soit 164 enquêtes une fois les sites multiples regroupés.

## Ce que la carte retient

`scripts/registre-vers-couches.py`, lancé depuis la racine du dépôt, écrit `enquetes.geojson` et la liste de `places/investigations.ts`. Il faut ensuite lancer `npm run layers -- france`.

- **Seules les enquêtes publiées depuis 2008 sont retenues.** 2008 est l'année de création de L214 et celle de la question de la carte. Le relevé contient 7 enregistrements plus anciens, de 2004 et 2007.
- **Deux enregistrements sont écartés** parce que les images ne viennent pas des enquêteurs de L214 : Kapparot à Marseille (2016, images d'un tiers) et les abattoirs de chevaux du Québec (images de la CHDC).
- **146 sites sont placés sur la carte :**
  - 92 à la commune ;
  - 45 au département, hachuré et sans point, placé au centre du département pour la description ;
  - 9 à la région, hachurée plus légèrement.
- **32 enquêtes sont citées sans lieu**, une ligne par enquête, même quand elle compte plusieurs sites : 29 sans lieu en France, 2 à l'étranger, 1 outre-mer (abattoir du Lamentin, Martinique).

## Limites et doutes

- Le site annonce « plus de 170 enquêtes ». Le relevé n'en trouve que 164, dont certaines menées avec d'autres associations (Eyes on Animals, CIWF).
- Les départements de quelques enquêtes viennent seulement du texte de la liste : Drôme Cailles, Pamprœuf, pintades LDC, Maître CoQ 2021, poulets LDC dans l'Orne.
- Quelques lieux sont déduits ou incertains :
  - « Périgord noir » est rapporté à la Dordogne.
  - Hénaff est placé en Bretagne d'après un titre de presse cité sur la page.
  - Pour les huit élevages fournissant E.Leclerc en 2025, le relevé suppose un élevage par commune nommée.
- La série « Stop cages » (2017-2019) compte peut-être deux enquêtes dans les Côtes-d'Armor au lieu d'une. L'enquête en Vendée de 2017 ne repose que sur un titre de vidéo.
- La liste date de 2025 l'enquête dans un élevage de lapins Carrefour ; sa page dit janvier 2026. C'est la date de la page qui est retenue.
- D'anciennes pages ont été rapprochées de pages republiées d'après l'année et l'espèce : rapprochement probable, pas certain.
