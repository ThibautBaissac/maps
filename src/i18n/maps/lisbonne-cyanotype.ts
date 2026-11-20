// The question and intro of lisbonne-cyanotype in every language, written in the map's voice
// (voices/lisbonne-cyanotype.md). Read at build time only: the page carries its own language's.
import type { MapStories } from '../types.ts';

export const STORY: MapStories = {
  fr: {
    question: 'Où les rues de l’Alfama deviennent-elles des escaliers ?',
    intro: 'Relevé des passages en escalier, quartier et abords. Chaque trait à barreaux marque un tronçon cartographié ; sa longueur se lit en plan, pas en hauteur.',
  },
  en: {
    question: 'Where do the streets of Alfama turn into stairs?',
    intro: 'Survey of stepped passages, in the neighbourhood and around it. Each barred line marks one mapped stretch of stairs; its length is read on the plan, not in height.',
  },
  es: {
    question: '¿Dónde se vuelven escaleras las calles de Alfama?',
    intro: 'Levantamiento de los pasos con escaleras, en el barrio y sus alrededores. Cada trazo con travesaños marca un tramo cartografiado; su longitud se lee en planta, no en altura.',
  },
  pt: {
    question: 'Onde é que as ruas de Alfama se tornam escadas?',
    intro: 'Levantamento das passagens em escada, no bairro e arredores. Cada traço com travessas marca um troço cartografado; o comprimento lê-se em planta, não em altura.',
  },
  de: {
    question: 'Wo werden die Straßen der Alfama zu Treppen?',
    intro: 'Aufnahme der Treppenwege, im Viertel und seiner Umgebung. Jede Linie mit Querstrichen markiert einen kartierten Abschnitt; ihre Länge gilt im Grundriss, nicht in der Höhe.',
  },
};
