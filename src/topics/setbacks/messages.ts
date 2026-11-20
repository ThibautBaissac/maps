// The texts of the setbacks subject in every language. metric, legend, method and limits are
// its facts and method in the plain house style, shared by every map of it (TopicFacts);
// the other strings serve its panel, its legend and its text description.
import type { Locale } from '../../i18n/types.ts';
import type { PeriodId } from './evidence.ts';
import type { TopicFacts } from '../types.ts';

export interface SetbackMessages extends TopicFacts {
  /** Building periods (src/topics/setbacks/evidence.ts). */
  periods: Record<PeriodId, string>;
  /** Row value: stepped towers among the detailed ones. */
  count: (stepped: string, detailed: string) => string;
  concentration: (share1916: string, share1961: string) => string;
  distribution: string;
  distributionHelp: (unknown: string) => string;
  steppedDetail: (year: string, height: string, levels: string) => string;
  blockDetail: (year: string, height: string) => string;
  /** Placeholder for a tower without start date. */
  noDate: string;
  source: string;
  /** Short legend labels drawn on the map. */
  legendStepped: string;
  legendBlock: string;
  legendOther: string;
}

export const MESSAGES: Record<Locale, SetbackMessages> = {
  fr: {
    metric: 'tours de 1916 à 1960 montent en gradins, parmi celles dont OSM détaille les volumes',
    legend: 'Volumes en relief à la hauteur OSM, sans exagération. Rouge et or : tours de 80 m ou plus qui montent en gradins. Bleu nuit : tours de 80 m ou plus d’un seul bloc. Crème : autres bâtiments, et tours dont OSM ne détaille pas les volumes. Cercles numérotés : repères.',
    method: 'Une tour est un bâtiment OSM d’au moins 80 m, parties comprises, dont le centre se trouve dans le carré. Hauteur : tag height, sinon building:levels × 3,2 m. Chaque partie de bâtiment (building:part) est rattachée au contour qui contient son centre. Une tour monte en gradins quand ses parties forment au moins trois paliers (hauteurs arrondies à 6 m) et que son palier supérieur couvre moins de 60 % de son emprise. La période suit la date de début des travaux (start_date) : avant 1916, de 1916 à 1960 sous le règlement de zonage de 1916, à partir de 1961 sous celui de 1961.',
    limits: 'La détection est automatique : une flèche cartographiée comme partie compte comme un palier, et un retrait dessiné d’un seul tenant peut passer inaperçu. Les tours sans parties dans OSM ou sans date ne sont pas classées. Le règlement de 1916 fixait une enveloppe, pas une forme : un gradin peut aussi être un choix d’architecte, et une tour autorisée avant 1961 a pu être commencée après. Le relief est schématique : vue oblique sans perspective, ombres symboliques.',
    periods: { 'before-1916': 'Avant 1916', 'zoning-1916': 'De 1916 à 1960', 'zoning-1961': 'À partir de 1961', undated: 'Date inconnue' },
    count: (stepped, detailed) => `${stepped} sur ${detailed}`,
    concentration: (share1916, share1961) => `${share1916} % des tours de 1916 à 1960 dont OSM détaille les volumes montent en gradins, contre ${share1961} % de celles commencées à partir de 1961.`,
    distribution: 'Tours à gradins par période de construction',
    distributionHelp: (unknown) => `Tours de 80 m ou plus dont le centre est dans le carré : tours à gradins sur tours dont OSM détaille les volumes. ${unknown} tours sans volumes détaillés ne sont pas classées.`,
    steppedDetail: (year, height, levels) => `${year} · ${height} m · ${levels} paliers de hauteur`,
    blockDetail: (year, height) => `${year} · ${height} m · un seul volume`,
    noDate: 'date inconnue',
    source: 'Hauteurs, volumes et dates de construction : OpenStreetMap (height, building:levels, building:part, start_date).',
    legendStepped: 'Tour à gradins',
    legendBlock: 'Tour d’un seul bloc',
    legendOther: 'Autres bâtiments',
  },
  en: {
    metric: 'towers of 1916–1960 rise in steps, among those whose volumes OSM details',
    legend: 'Volumes raised to their OSM height, without exaggeration. Red and gold: towers of 80 m or more that rise in steps. Midnight blue: towers of 80 m or more in a single block. Cream: other buildings, and towers whose volumes OSM does not detail. Numbered circles: references.',
    method: 'A tower is an OSM building at least 80 m tall, parts included, whose centre lies in the square. Height: the height tag, otherwise building:levels × 3.2 m. Each building part (building:part) belongs to the outline that holds its centre. A tower rises in steps when its parts form at least three levels (heights rounded to 6 m) and its top level covers less than 60% of its footprint. The period follows the start of works (start_date): before 1916, 1916 to 1960 under the 1916 zoning resolution, from 1961 under the 1961 one.',
    limits: 'Detection is automatic: a spire mapped as a part counts as a level, and a setback drawn as one piece can go unnoticed. Towers without parts in OSM or without a date are not classified. The 1916 rules set an envelope, not a shape: a step can also be an architect’s choice, and a tower approved before 1961 may have been begun later. The relief is schematic: oblique view without perspective, symbolic shadows.',
    periods: { 'before-1916': 'Before 1916', 'zoning-1916': '1916 to 1960', 'zoning-1961': '1961 onwards', undated: 'Unknown date' },
    count: (stepped, detailed) => `${stepped} of ${detailed}`,
    concentration: (share1916, share1961) => `${share1916}% of the 1916–1960 towers whose volumes OSM details rise in steps, against ${share1961}% of those begun from 1961 onwards.`,
    distribution: 'Stepped towers by building period',
    distributionHelp: (unknown) => `Towers of 80 m or more whose centre lies in the square: stepped towers out of towers whose volumes OSM details. ${unknown} towers without detailed volumes are not classified.`,
    steppedDetail: (year, height, levels) => `${year} · ${height} m · ${levels} height levels`,
    blockDetail: (year, height) => `${year} · ${height} m · a single volume`,
    noDate: 'unknown date',
    source: 'Heights, volumes and construction dates: OpenStreetMap (height, building:levels, building:part, start_date).',
    legendStepped: 'Stepped tower',
    legendBlock: 'Single-block tower',
    legendOther: 'Other buildings',
  },
  es: {
    metric: 'torres de 1916 a 1960 suben en escalones, entre aquellas cuyos volúmenes detalla OSM',
    legend: 'Volúmenes en relieve a su altura OSM, sin exageración. Rojo y oro: torres de 80 m o más que suben en escalones. Azul noche: torres de 80 m o más de un solo bloque. Crema: otros edificios, y torres cuyos volúmenes OSM no detalla. Círculos numerados: referencias.',
    method: 'Una torre es un edificio de OSM de al menos 80 m, partes incluidas, cuyo centro está en el cuadrado. Altura: etiqueta height, si no building:levels × 3,2 m. Cada parte de edificio (building:part) se asigna al contorno que contiene su centro. Una torre sube en escalones cuando sus partes forman al menos tres niveles (alturas redondeadas a 6 m) y su nivel superior cubre menos del 60 % de su planta. El periodo sigue la fecha de inicio de obras (start_date): antes de 1916, de 1916 a 1960 bajo la ordenanza de zonificación de 1916, desde 1961 bajo la de 1961.',
    limits: 'La detección es automática: una aguja cartografiada como parte cuenta como un nivel, y un retranqueo dibujado de una sola pieza puede pasar inadvertido. Las torres sin partes en OSM o sin fecha no se clasifican. La ordenanza de 1916 fijaba una envolvente, no una forma: un escalón también puede ser una elección del arquitecto, y una torre autorizada antes de 1961 pudo comenzarse después. El relieve es esquemático: vista oblicua sin perspectiva, sombras simbólicas.',
    periods: { 'before-1916': 'Antes de 1916', 'zoning-1916': 'De 1916 a 1960', 'zoning-1961': 'Desde 1961', undated: 'Fecha desconocida' },
    count: (stepped, detailed) => `${stepped} de ${detailed}`,
    concentration: (share1916, share1961) => `El ${share1916} % de las torres de 1916 a 1960 cuyos volúmenes detalla OSM suben en escalones, frente al ${share1961} % de las comenzadas desde 1961.`,
    distribution: 'Torres escalonadas por periodo de construcción',
    distributionHelp: (unknown) => `Torres de 80 m o más cuyo centro está en el cuadrado: torres escalonadas sobre torres cuyos volúmenes detalla OSM. ${unknown} torres sin volúmenes detallados no se clasifican.`,
    steppedDetail: (year, height, levels) => `${year} · ${height} m · ${levels} niveles de altura`,
    blockDetail: (year, height) => `${year} · ${height} m · un solo volumen`,
    noDate: 'fecha desconocida',
    source: 'Alturas, volúmenes y fechas de construcción: OpenStreetMap (height, building:levels, building:part, start_date).',
    legendStepped: 'Torre escalonada',
    legendBlock: 'Torre de un solo bloque',
    legendOther: 'Otros edificios',
  },
  pt: {
    metric: 'torres de 1916 a 1960 sobem em degraus, entre as que o OSM detalha em volumes',
    legend: 'Volumes em relevo à altura do OSM, sem exagero. Vermelho e dourado: torres de 80 m ou mais que sobem em degraus. Azul-noite: torres de 80 m ou mais de um só bloco. Creme: outros edifícios, e torres cujos volumes o OSM não detalha. Círculos numerados: referências.',
    method: 'Uma torre é um edifício do OSM com pelo menos 80 m, partes incluídas, cujo centro fica no quadrado. Altura: etiqueta height, senão building:levels × 3,2 m. Cada parte de edifício (building:part) é atribuída ao contorno que contém o seu centro. Uma torre sobe em degraus quando as suas partes formam pelo menos três patamares (alturas arredondadas a 6 m) e o patamar superior cobre menos de 60 % da sua implantação. O período segue a data de início da obra (start_date): antes de 1916, de 1916 a 1960 ao abrigo do regulamento de zonamento de 1916, a partir de 1961 ao abrigo do de 1961.',
    limits: 'A deteção é automática: uma flecha cartografada como parte conta como patamar, e um recuo desenhado numa só peça pode passar despercebido. As torres sem partes no OSM ou sem data não são classificadas. O regulamento de 1916 fixava um envelope, não uma forma: um degrau também pode ser escolha do arquiteto, e uma torre autorizada antes de 1961 pode ter sido iniciada depois. O relevo é esquemático: vista oblíqua sem perspetiva, sombras simbólicas.',
    periods: { 'before-1916': 'Antes de 1916', 'zoning-1916': 'De 1916 a 1960', 'zoning-1961': 'A partir de 1961', undated: 'Data desconhecida' },
    count: (stepped, detailed) => `${stepped} em ${detailed}`,
    concentration: (share1916, share1961) => `${share1916} % das torres de 1916 a 1960 cujos volumes o OSM detalha sobem em degraus, contra ${share1961} % das iniciadas a partir de 1961.`,
    distribution: 'Torres em degraus por período de construção',
    distributionHelp: (unknown) => `Torres de 80 m ou mais cujo centro fica no quadrado: torres em degraus sobre torres cujos volumes o OSM detalha. ${unknown} torres sem volumes detalhados não são classificadas.`,
    steppedDetail: (year, height, levels) => `${year} · ${height} m · ${levels} patamares de altura`,
    blockDetail: (year, height) => `${year} · ${height} m · um só volume`,
    noDate: 'data desconhecida',
    source: 'Alturas, volumes e datas de construção: OpenStreetMap (height, building:levels, building:part, start_date).',
    legendStepped: 'Torre em degraus',
    legendBlock: 'Torre de um só bloco',
    legendOther: 'Outros edifícios',
  },
  de: {
    metric: 'Türme von 1916 bis 1960 steigen in Stufen an, unter denen, deren Baukörper OSM erfasst',
    legend: 'Baukörper in ihrer OSM-Höhe, ohne Überhöhung. Rot und Gold: Türme ab 80 m, die in Stufen ansteigen. Nachtblau: Türme ab 80 m aus einem Block. Creme: andere Gebäude und Türme, deren Baukörper OSM nicht erfasst. Nummerierte Kreise: Bezugspunkte.',
    method: 'Ein Turm ist ein OSM-Gebäude von mindestens 80 m Höhe, Gebäudeteile eingeschlossen, dessen Mitte im Quadrat liegt. Höhe: Tag height, sonst building:levels × 3,2 m. Jeder Gebäudeteil (building:part) gehört zu dem Umriss, der seine Mitte enthält. Ein Turm steigt in Stufen an, wenn seine Teile mindestens drei Höhenstufen bilden (Höhen auf 6 m gerundet) und seine oberste Stufe weniger als 60 % seiner Grundfläche bedeckt. Die Bauzeit folgt dem Baubeginn (start_date): vor 1916, 1916 bis 1960 unter der Bauordnung von 1916, ab 1961 unter der von 1961.',
    limits: 'Die Erkennung ist automatisch: Eine als Gebäudeteil kartierte Turmspitze zählt als Stufe, und ein in einem Stück gezeichneter Rücksprung kann unbemerkt bleiben. Türme ohne Gebäudeteile in OSM oder ohne Datum werden nicht eingeordnet. Die Bauordnung von 1916 legte eine Hüllform fest, keine Gestalt: Eine Stufe kann auch eine Entscheidung des Architekten sein, und ein vor 1961 genehmigter Turm kann später begonnen worden sein. Das Relief ist schematisch: Schrägansicht ohne Perspektive, symbolische Schatten.',
    periods: { 'before-1916': 'Vor 1916', 'zoning-1916': '1916 bis 1960', 'zoning-1961': 'Ab 1961', undated: 'Datum unbekannt' },
    count: (stepped, detailed) => `${stepped} von ${detailed}`,
    concentration: (share1916, share1961) => `${share1916} % der Türme von 1916 bis 1960, deren Baukörper OSM erfasst, steigen in Stufen an, gegenüber ${share1961} % der ab 1961 begonnenen.`,
    distribution: 'Gestufte Türme nach Bauzeit',
    distributionHelp: (unknown) => `Türme ab 80 m, deren Mitte im Quadrat liegt: gestufte Türme unter den Türmen, deren Baukörper OSM erfasst. ${unknown} Türme ohne erfasste Baukörper werden nicht eingeordnet.`,
    steppedDetail: (year, height, levels) => `${year} · ${height} m · ${levels} Höhenstufen`,
    blockDetail: (year, height) => `${year} · ${height} m · ein einziger Baukörper`,
    noDate: 'Datum unbekannt',
    source: 'Höhen, Baukörper und Baudaten: OpenStreetMap (height, building:levels, building:part, start_date).',
    legendStepped: 'Gestufter Turm',
    legendBlock: 'Turm aus einem Block',
    legendOther: 'Andere Gebäude',
  },
};
