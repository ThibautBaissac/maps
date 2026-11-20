// The question and intro of france-dossier in every language, written in the map's voice
// (voices/france-dossier.md). Read at build time only: the page carries its own language's.
import type { MapStories } from '../types.ts';

export const STORY: MapStories = {
  fr: {
    question: 'Où L214 a-t-elle enquêté depuis 2008 ?',
    intro: 'Chaque marque situe une enquête publiée : un abattoir, un élevage, un couvoir. Quand seul le département ou la région est connu, la zone entière est hachurée plutôt qu’un point inventé. Les enquêtes sans lieu sont citées à part.',
  },
  en: {
    question: 'Where has L214 investigated since 2008?',
    intro: 'Each mark locates a published investigation: a slaughterhouse, a farm, a hatchery. Where only the department or region is known, the whole area is hatched rather than given an invented point. Investigations without a place are listed apart.',
  },
  es: {
    question: '¿Dónde ha investigado L214 desde 2008?',
    intro: 'Cada marca sitúa una investigación publicada: un matadero, una granja, una incubadora. Cuando solo se conoce el departamento o la región, se raya toda la zona en lugar de inventar un punto. Las investigaciones sin lugar se citan aparte.',
  },
  pt: {
    question: 'Onde investigou a L214 desde 2008?',
    intro: 'Cada marca situa uma investigação publicada: um matadouro, uma exploração, uma incubadora. Quando só se conhece o departamento ou a região, a zona inteira fica tracejada em vez de receber um ponto inventado. As investigações sem local são citadas à parte.',
  },
  de: {
    question: 'Wo hat L214 seit 2008 recherchiert?',
    intro: 'Jede Markierung verortet eine veröffentlichte Recherche: einen Schlachthof, einen Betrieb, eine Brüterei. Ist nur das Département oder die Region bekannt, wird die ganze Fläche schraffiert statt eines erfundenen Punkts. Recherchen ohne Ort sind gesondert aufgeführt.',
  },
};
