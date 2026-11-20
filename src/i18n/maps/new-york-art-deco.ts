// The question and intro of new-york-art-deco in every language, written in the map's voice
// (voices/new-york-art-deco.md). Read at build time only: the page carries its own language's.
import type { MapStories } from '../types.ts';

export const STORY: MapStories = {
  fr: {
    question: 'Pourquoi les tours de Midtown construites entre 1916 et 1961 montent-elles en gradins ?',
    intro: 'Regardez la maquette d’en haut : les tours de cette époque reculent par marches à mesure qu’elles montent. Le règlement de 1916 l’exigeait, pour que la lumière descende encore jusqu’à la rue. En 1961, une autre loi l’abandonne, et dans les années 1970 la plupart des tours se dressent d’un seul bloc.',
  },
  en: {
    question: 'Why do the Midtown towers built between 1916 and 1961 rise in steps?',
    intro: 'Look down on the model: the towers of that era step back as they climb. The 1916 rules required it, so that light could still reach the street. In 1961 a new law dropped the requirement, and most towers of the 1970s went up in a single block.',
  },
  es: {
    question: '¿Por qué las torres de Midtown construidas entre 1916 y 1961 suben en escalones?',
    intro: 'Mire la maqueta desde arriba: las torres de esa época retroceden en escalones a medida que suben. El reglamento de 1916 lo exigía, para que la luz siguiera bajando hasta la calle. En 1961 otra ley lo abandona, y en los años setenta la mayoría de las torres se alzan de un solo bloque.',
  },
  pt: {
    question: 'Porque é que as torres de Midtown construídas entre 1916 e 1961 sobem em degraus?',
    intro: 'Olhe para a maqueta de cima: as torres dessa época recuam em degraus à medida que sobem. O regulamento de 1916 exigia-o, para que a luz continuasse a chegar à rua. Em 1961, outra lei abandona a regra, e nos anos 1970 a maioria das torres ergue-se num só bloco.',
  },
  de: {
    question: 'Warum steigen die zwischen 1916 und 1961 gebauten Türme von Midtown in Stufen an?',
    intro: 'Schauen Sie von oben auf das Modell: Die Türme dieser Zeit treten nach oben hin stufenweise zurück. Die Bauordnung von 1916 verlangte es, damit das Licht noch bis auf die Straße fiel. 1961 gab ein neues Gesetz diese Regel auf, und die meisten Türme der 1970er-Jahre wachsen als ein einziger Block.',
  },
};
