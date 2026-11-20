// The texts of the steps subject in every language. metric, legend, method and limits are
// its facts and method in the plain house style, shared by every map of it (TopicFacts);
// the shared linear strings serve its panel, its legend and its text description.
import type { Locale } from '../../i18n/types.ts';
import { LINEAR_MESSAGES, type LinearMessages } from '../linear/messages.ts';

export const MESSAGES: Record<Locale, LinearMessages> = {
  fr: {
    ...LINEAR_MESSAGES.fr,
    metric: 'de tronçons d’escaliers cartographiés dans la zone',
    legend: 'Traits épais à barreaux : tronçons d’escaliers. Cercles numérotés : repères nommés. Les barreaux sont un symbole et ne représentent pas le nombre de marches. L’eau et le bâti servent de contexte.',
    method: 'Sélection des voies OSM de catégorie escalier, hors tunnels. Longueurs en plan, coupées aux limites du carré, puis réparties en neuf secteurs égaux. Les repères regroupent les tronçons par nom ; le repère désigne un point sur le plus long tronçon du groupe. Un trait le relie au numéro si celui-ci doit se décaler.',
    limits: 'Ces longueurs ne mesurent ni le dénivelé ni le nombre de marches ou d’escaliers. La couverture OSM peut être incomplète. Une voie sans symbole d’escalier ne garantit pas un parcours accessible.',
  },
  en: {
    ...LINEAR_MESSAGES.en,
    metric: 'of mapped stair segments in the area',
    legend: 'Thick lines with crossbars: stair segments. Numbered circles: named reference points. Crossbars are a symbol and do not show the number of steps. Water and buildings provide context.',
    method: 'Select OSM ways classified as steps, excluding tunnels. Plan lengths are clipped to the square and distributed across nine equal sectors. Reference points group segments by name; the reference identifies a point on the longest segment in the group. A leader connects the number to this point if the badge needs to move.',
    limits: 'These lengths measure neither elevation gain nor the number of steps or staircases. OSM coverage may be incomplete. A way without a stairs symbol does not guarantee an accessible route.',
  },
  es: {
    ...LINEAR_MESSAGES.es,
    metric: 'de tramos de escaleras cartografiados en la zona',
    legend: 'Líneas gruesas con travesaños: tramos de escaleras. Círculos numerados: referencias con nombre. Los travesaños son un símbolo y no representan el número de peldaños. El agua y los edificios sirven de contexto.',
    method: 'Selección de vías OSM de categoría escalera, salvo túneles. Las longitudes en planta se recortan al cuadrado y se distribuyen en nueve sectores iguales. Las referencias agrupan los tramos por nombre; la referencia identifica un punto del tramo más largo del grupo. Una línea une el número a este punto si el círculo debe desplazarse.',
    limits: 'Estas longitudes no miden el desnivel ni el número de peldaños o escaleras. La cobertura OSM puede ser incompleta. Una vía sin símbolo de escalera no garantiza un recorrido accesible.',
  },
  pt: {
    ...LINEAR_MESSAGES.pt,
    metric: 'de troços de escadas cartografados na área',
    legend: 'Linhas grossas com travessas: troços de escadas. Círculos numerados: referências com nome. As travessas são um símbolo e não representam o número de degraus. A água e os edifícios servem de contexto.',
    method: 'Seleção das vias OSM da categoria escada, exceto túneis. Os comprimentos em planta são recortados ao quadrado e repartidos por nove setores iguais. As referências agrupam os troços por nome; a referência identifica um ponto do troço mais longo do grupo. Uma linha liga o número a esse ponto se o círculo tiver de ser deslocado.',
    limits: 'Estes comprimentos não medem o desnível nem o número de degraus ou de escadas. A cobertura do OSM pode estar incompleta. Uma via sem símbolo de escada não garante um percurso acessível.',
  },
  de: {
    ...LINEAR_MESSAGES.de,
    metric: 'kartierte Treppenabschnitte im Ausschnitt',
    legend: 'Dicke Linien mit Querstrichen: Treppenabschnitte. Nummerierte Kreise: benannte Orientierungspunkte. Die Querstriche sind ein Symbol und geben nicht die Zahl der Stufen wieder. Wasser und Gebäude dienen als Kontext.',
    method: 'Auswahl der OSM-Wege der Kategorie Treppe, ohne Tunnel. Die Längen im Grundriss werden auf das Quadrat zugeschnitten und auf neun gleiche Sektoren verteilt. Die Orientierungspunkte fassen Abschnitte nach Namen zusammen; der Punkt markiert eine Stelle des längsten Abschnitts der Gruppe. Eine Linie verbindet die Nummer mit dieser Stelle, wenn der Kreis verschoben werden muss.',
    limits: 'Diese Längen messen weder Höhenunterschied noch die Zahl der Stufen oder Treppen. Die OSM-Abdeckung kann unvollständig sein. Ein Weg ohne Treppensymbol ist nicht zwingend barrierefrei.',
  },
};
