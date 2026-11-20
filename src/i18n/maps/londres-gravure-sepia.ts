// The question and intro of londres-gravure-sepia in every language, written in the map's voice
// (voices/londres-gravure-sepia.md). Read at build time only: the page carries its own language's.
import type { MapStories } from '../types.ts';

export const STORY: MapStories = {
  fr: {
    question: 'Pourquoi les morts du choléra de 1854, à Soho, entourent-elles une seule pompe ?',
    intro: 'En dix jours, à la fin de l’été 1854, plus de cinq cents personnes meurent du choléra autour de Broad Street. Le médecin John Snow porte les décès sur un plan de rue : ils se serrent autour de la pompe du quartier.',
  },
  en: {
    question: 'Why do the 1854 cholera deaths in Soho gather around a single pump?',
    intro: 'In ten days at the end of the summer of 1854, more than five hundred people died of cholera around Broad Street. The physician John Snow marked the deaths on a street plan: they crowd around the neighbourhood pump.',
  },
  es: {
    question: '¿Por qué las muertes del cólera de 1854, en el Soho, rodean una sola bomba?',
    intro: 'En diez días, a finales del verano de 1854, más de quinientas personas murieron de cólera en torno a Broad Street. El médico John Snow marcó las muertes en un plano de calles: se agolpan alrededor de la bomba del barrio.',
  },
  pt: {
    question: 'Porque é que as mortes de cólera de 1854, no Soho, rodeiam uma única bomba?',
    intro: 'Em dez dias, no fim do verão de 1854, mais de quinhentas pessoas morreram de cólera em torno de Broad Street. O médico John Snow marcou as mortes numa planta das ruas: concentram-se à volta da bomba do bairro.',
  },
  de: {
    question: 'Warum sammeln sich die Cholera-Toten von 1854 in Soho um eine einzige Pumpe?',
    intro: 'In zehn Tagen, am Ende des Sommers 1854, starben rund um die Broad Street mehr als fünfhundert Menschen an Cholera. Der Arzt John Snow trug die Todesfälle in einen Straßenplan ein: Sie drängen sich um die Pumpe des Viertels.',
  },
};
