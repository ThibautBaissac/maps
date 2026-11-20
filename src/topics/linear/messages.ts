// The strings shared by the subjects measured as lengths of street sections, in every language.
import type { Locale } from '../../i18n/types.ts';
import type { TopicFacts } from '../types.ts';

export interface LinearStrings {
  distribution: string;
  distributionHelp: string;
  /** The sector holding the largest share of the length. */
  concentration: (position: string, share: string) => string;
  /** The canals a named group of sections crosses (canal-crossings). */
  waterCrossed: (names: string) => string;
}

/** The texts of a linear subject: its facts and method, then the shared strings. */
export type LinearMessages = TopicFacts & LinearStrings;

export const LINEAR_MESSAGES: Record<Locale, LinearStrings> = {
  fr: {
    distribution: 'Répartition dans la zone',
    distributionHelp: 'Longueur par secteur, en mètres. Le nord se trouve en haut ; les neuf secteurs ont la même surface.',
    concentration: (position, share) => `Le secteur ${position} rassemble ${share} % de la longueur représentée.`,
    waterCrossed: (names) => `Canaux croisés par les tronçons portant ce nom : ${names}.`,
  },
  en: {
    distribution: 'Distribution across the area',
    distributionHelp: 'Length by sector, in metres. North is at the top; all nine sectors have the same area.',
    concentration: (position, share) => `The sector ${position} contains ${share}% of the length shown.`,
    waterCrossed: (names) => `Canals crossed by segments with this name: ${names}.`,
  },
  es: {
    distribution: 'Distribución en la zona',
    distributionHelp: 'Longitud por sector, en metros. El norte está arriba; los nueve sectores tienen la misma superficie.',
    concentration: (position, share) => `El sector ${position} reúne el ${share} % de la longitud representada.`,
    waterCrossed: (names) => `Canales cruzados por los tramos con este nombre: ${names}.`,
  },
  pt: {
    distribution: 'Distribuição na área',
    distributionHelp: 'Comprimento por setor, em metros. O norte está em cima; os nove setores têm a mesma superfície.',
    concentration: (position, share) => `O setor ${position} reúne ${share} % do comprimento representado.`,
    waterCrossed: (names) => `Canais atravessados pelos troços com este nome: ${names}.`,
  },
  de: {
    distribution: 'Verteilung im Ausschnitt',
    distributionHelp: 'Länge je Sektor, in Metern. Norden ist oben; die neun Sektoren sind gleich groß.',
    concentration: (position, share) => `Der Sektor ${position} vereint ${share} % der dargestellten Länge.`,
    waterCrossed: (names) => `Von den Abschnitten dieses Namens überquerte Kanäle: ${names}.`,
  },
};
