# Soho, choléra de 1854 : numérisation de la carte de John Snow

Les trois couches de ce dossier viennent de la carte 1 de John Snow, *On the Mode of Communication of Cholera* (2ᵉ éd., 1855), domaine public :
[File:Snow-cholera-map-1.jpg](https://commons.wikimedia.org/wiki/File:Snow-cholera-map-1.jpg) sur Wikimedia Commons, 20 124 × 18 877 px, niveaux de gris, téléchargée le 17 novembre 2026 (SHA-256 `0c540497…f9dec9870a`).

Aucune numérisation existante n'a été reprise : celles de Robin Wilson, de Tobler (paquet R `HistData`) et du paquet `SnowData` n'ont pas de licence ouverte claire, ou sont sous GPL.

| Fichier | Contenu |
|---|---|
| `pompes.geojson` | les 13 pompes de la carte ; `kind` vaut `broad-street` pour la pompe de Broad Street, `pump` pour les autres ; `name` est la rue actuelle la plus proche |
| `deces.geojson` | un point par groupe de barres, avec `deaths`, le nombre de barres du groupe |
| `reperes.geojson` | la workhouse de Poland Street et la brasserie de Broad Street, au centre de leur îlot sur la carte |

## Méthode

Les scripts de `digitisation/` (Python 3, Pillow, NumPy, SciPy) refont chaque étape. Les coordonnées « affichage » sont celles d'une réduction de la carte à 2 000 px de large, divisées par 1,01.

1. **Barres** (`bars.py`). L'image est réduite de moitié, seuillée (`< 110`), puis ouverte par un disque de rayon 6 px. L'ouverture efface les traits fins (rues, contours, la plupart des lettres) et garde l'encre épaisse : les barres de décès, les pompes, les tirets de la limite du quartier et quelques lettres grasses.
2. **Tri et comptage** (`count.py`). Le script écarte le cadre, les étiquettes « PUMP », les disques des pompes, les tirets de la limite (tracé relevé à la main, tampon de 16 px) et les taches trapues de moins de 110 px de long, qui sont des lettres. Chaque groupe restant compte `round(surface / surface d'une barre)` décès, avec une surface de référence égale à la médiane des barres isolées (4 408 px). Le disque de la pompe de Broad Street touche des barres : sa surface (4 500 px) est retranchée.
3. **Calage** (`fit.py`, `control-points.json`, `affine.json`). Une transformation affine relie la carte aux mètres locaux du lieu `londres-soho`. Elle s'appuie sur quatre repères encore en place : le centre de Golden Square, le centre de Soho Square, le centre d'Oxford Circus et le carrefour Broadwick Street × Lexington Street (Broad Street × Cambridge Street en 1854). L'écart quadratique moyen vaut 1,7 m ; la superposition du réseau OSM actuel sur la carte reste juste sur toute son étendue.
4. **Export** (`export.py`). Chaque groupe de barres est ramené à son point le plus proche d'une rue OSM, ce qui approche l'adresse. Le script écrit ensuite les coordonnées en WGS84 avec l'inverse de la projection locale de `src/geo.ts`.

## Résultat et limites

- 556 décès répartis sur 404 points, contre 578 barres dans la numérisation de Tobler (1992). Quelques barres fusionnées, effacées ou confondues avec des lettres restent mal comptées.
- Un groupe peut réunir deux adresses voisines dont les barres se touchent.
- Les points sont placés à quelques mètres près ; ils ne désignent pas un numéro de rue.
- La pompe de Rupert Street a été renommée à la main : la rue la plus proche calculée était Archer Street.
