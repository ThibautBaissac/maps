// The texts of the canal-crossings subject in every language. metric, legend, method and limits are
// its facts and method in the plain house style, shared by every map of it (TopicFacts);
// the shared linear strings serve its panel, its legend and its text description.
import type { Locale } from '../../i18n/types.ts';
import { LINEAR_MESSAGES, type LinearMessages } from '../linear/messages.ts';

export const MESSAGES: Record<Locale, LinearMessages> = {
  fr: {
    ...LINEAR_MESSAGES.fr,
    metric: 'de voies sur pont repérées au croisement des canaux',
    legend: 'Traits épais bordés de papier : voies sur pont croisant un canal. Cercles numérotés : repères nommés. Hachures : eau. Les autres voies et le bâti restent en retrait.',
    method: 'Sélection des voies marquées comme pont qui croisent l’axe d’un canal de surface OSM dans le carré. Les longueurs additionnent les tronçons retenus, coupés aux limites du carré. Les repères regroupent les tronçons par nom ; un nom peut désigner plusieurs passages. Le repère désigne un point sur le plus long tronçon du groupe. Un trait le relie au numéro si celui-ci doit se décaler.',
    limits: 'Le chiffre mesure une longueur de voies, pas un nombre de ponts. Il peut omettre un passage si le pont ou l’axe du canal manque dans OSM. Les voies parallèles comptent chacune dans la longueur. Un canal est ici toute voie d’eau classée « canal » dans OSM, ce qui inclut certains bassins. Le dessin ne garantit pas l’accès à pied ou à vélo.',
  },
  en: {
    ...LINEAR_MESSAGES.en,
    metric: 'of mapped bridge segments crossing canals',
    legend: 'Thick lines with a paper border: bridge segments crossing a canal. Numbered circles: named reference points. Hatching: water. Other streets and buildings appear faintly.',
    method: 'Select roads and paths tagged as bridges that intersect a surface canal axis in OSM within the square. Lengths add the selected segments, clipped to the square. Reference points group segments by name; one name may cover several crossings. The reference identifies a point on the longest segment in the group. A leader connects the number to this point if the badge needs to move.',
    limits: 'The figure measures a length of roads and paths, not a number of bridges. It may miss crossings when a bridge or canal axis is absent from OSM. Parallel paths each contribute to the length. A canal here is any waterway tagged “canal” in OSM, which includes some basins. The drawing does not guarantee pedestrian or cycling access.',
  },
  es: {
    ...LINEAR_MESSAGES.es,
    metric: 'de tramos sobre puentes que cruzan canales',
    legend: 'Líneas gruesas con borde de papel: vías sobre puentes que cruzan un canal. Círculos numerados: referencias con nombre. Rayado: agua. Las demás vías y edificios aparecen atenuados.',
    method: 'Selección de vías marcadas como puentes que cruzan el eje de un canal de superficie OSM dentro del cuadrado. Las longitudes suman los tramos seleccionados, recortados al cuadrado. Las referencias agrupan los tramos por nombre; un nombre puede abarcar varios pasos. La referencia identifica un punto del tramo más largo del grupo. Una línea une el número a este punto si el círculo debe desplazarse.',
    limits: 'La cifra mide una longitud de vías, no un número de puentes. Puede omitir pasos si falta el puente o el eje del canal en OSM. Las vías paralelas contribuyen por separado a la longitud. Aquí un canal es cualquier curso de agua clasificado como «canal» en OSM, lo que incluye algunas dársenas. El dibujo no garantiza el acceso peatonal o ciclista.',
  },
  pt: {
    ...LINEAR_MESSAGES.pt,
    metric: 'de troços sobre pontes que atravessam canais',
    legend: 'Linhas grossas com margem de papel: vias sobre pontes que atravessam um canal. Círculos numerados: referências com nome. Tracejado: água. As restantes vias e edifícios ficam esbatidos.',
    method: 'Seleção das vias marcadas como pontes que atravessam o eixo de um canal de superfície OSM dentro do quadrado. Os comprimentos somam os troços selecionados, recortados ao quadrado. As referências agrupam os troços por nome; um nome pode abranger várias passagens. A referência identifica um ponto do troço mais longo do grupo. Uma linha liga o número a esse ponto se o círculo tiver de ser deslocado.',
    limits: 'O valor mede um comprimento de vias, não um número de pontes. Pode omitir passagens se faltar a ponte ou o eixo do canal no OSM. As vias paralelas contam separadamente para o comprimento. Aqui, um canal é qualquer curso de água classificado como «canal» no OSM, o que inclui algumas docas. O desenho não garante o acesso a peões ou bicicletas.',
  },
  de: {
    ...LINEAR_MESSAGES.de,
    metric: 'Brückenabschnitte über Kanälen',
    legend: 'Dicke Linien mit Papierrand: Wege auf Brücken über einen Kanal. Nummerierte Kreise: benannte Orientierungspunkte. Schraffur: Wasser. Die übrigen Wege und Gebäude treten zurück.',
    method: 'Auswahl der als Brücke markierten Wege, die die Achse eines OSM-Kanals im Quadrat kreuzen. Die Längen summieren die ausgewählten, auf das Quadrat zugeschnittenen Abschnitte. Die Orientierungspunkte fassen Abschnitte nach Namen zusammen; ein Name kann mehrere Übergänge umfassen. Der Punkt markiert eine Stelle des längsten Abschnitts der Gruppe. Eine Linie verbindet die Nummer mit dieser Stelle, wenn der Kreis verschoben werden muss.',
    limits: 'Die Zahl misst eine Weglänge, keine Anzahl von Brücken. Übergänge können fehlen, wenn die Brücke oder die Kanalachse in OSM fehlt. Parallele Wege zählen einzeln zur Länge. Ein Kanal ist hier jedes in OSM als „canal“ eingestufte Gewässer, darunter auch einige Hafenbecken. Die Zeichnung sagt nichts darüber, ob Fußgänger oder Radfahrer passieren dürfen.',
  },
};
