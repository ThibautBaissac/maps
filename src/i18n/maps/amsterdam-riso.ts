// The question and intro of amsterdam-riso in every language, written in the map's voice
// (voices/amsterdam-riso.md). Read at build time only: the page carries its own language's.
import type { MapStories } from '../types.ts';

export const STORY: MapStories = {
  fr: {
    question: 'Où passer d’une rive à l’autre dans le centre d’Amsterdam ?',
    intro: 'Ici, les canaux tracent la ville en anneaux. Pour traverser, il te faut un pont : la carte les fait ressortir, le reste s’efface.',
  },
  en: {
    question: 'Where can you get from one bank to the other in central Amsterdam?',
    intro: 'Here the canals draw the city in rings. To cross, you need a bridge: the map brings them out and lets the rest fade.',
  },
  es: {
    question: '¿Por dónde pasar de una orilla a otra en el centro de Ámsterdam?',
    intro: 'Aquí los canales dibujan la ciudad en anillos. Para cruzar necesitas un puente: el mapa los resalta y deja que el resto se desvanezca.',
  },
  pt: {
    question: 'Por onde passar de uma margem à outra no centro de Amesterdão?',
    intro: 'Aqui, os canais desenham a cidade em anéis. Para atravessar, precisas de uma ponte: o mapa fá-las sobressair e deixa o resto apagar-se.',
  },
  de: {
    question: 'Wo kommst du im Zentrum von Amsterdam von einem Ufer ans andere?',
    intro: 'Hier zeichnen die Grachten die Stadt in Ringen. Zum Überqueren brauchst du eine Brücke: Die Karte hebt sie hervor und lässt den Rest verblassen.',
  },
};
