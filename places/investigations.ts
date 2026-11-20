// L214 investigations published without a place in metropolitan France (transport, sea,
// sites not named, several sites at once): the investigations subject cites them beside the
// map. The located ones are the enquetes layer of the france place (places/layers.ts).
// Compiled from https://www.l214.com/enquetes/ on 2026-11-18; method in layers/france/README.md.
import type { UnlocatedInvestigation } from '../src/topics/investigations/evidence.ts';

export const UNLOCATED_INVESTIGATIONS: readonly UnlocatedInvestigation[] = [
  { year: 2008, site: 'elevage', name: 'Élevage de canards - Foie gras - Euralis', url: '' },
  { year: 2008, site: 'elevage', name: 'Élevage de lapins', url: 'https://www.l214.com/video/elevage-lapins-2008' },
  { year: 2009, site: 'elevage', name: 'Élevage de poules', url: 'https://www.l214.com/elevage-intensif-poules-pondeuses' },
  { year: 2010, site: 'elevage', name: 'Élevage de canards - Foie gras - Euralis', url: 'https://stop-foie-gras.com/video-foie-gras-euralis-montfort.php' },
  { year: 2010, site: 'elevage', name: 'Élevage de lapins', url: 'https://www.l214.com/video/elevage-lapins-2009' },
  { year: 2011, site: 'autre', name: 'Marchés aux bestiaux', url: 'https://www.l214.com/video/marche-bestiaux-2009' },
  { year: 2011, site: 'elevage', name: 'Élevage de cailles', url: 'https://www.l214.com/video/elevage-cailles-2010' },
  { year: 2011, site: 'elevage', name: 'Élevage de cochons', url: 'https://www.l214.com/video/elevage-cochons-2007-2008-2010' },
  { year: 2011, site: 'elevage', name: 'Élevage de dindons', url: '' },
  { year: 2011, site: 'elevage', name: 'Élevage de lapins', url: '' },
  { year: 2011, site: 'elevage', name: 'Élevage de poules - Monoprix (et autres)', url: 'https://www.l214.com/video/poules-pondeuses-enquete-2011' },
  { year: 2011, site: 'elevage', name: 'Élevage de poules pondeuses', url: 'https://www.l214.com/video/poules-pondeuses-2010' },
  { year: 2011, site: 'elevage', name: 'Élevage de poulets', url: 'https://www.l214.com/salon-agriculture-2011/7eme-jour-poulets' },
  { year: 2011, site: 'elevage', name: 'Élevage des dindes', url: 'https://www.l214.com/salon-agriculture-2011/9eme-jour-dindes' },
  { year: 2012, site: 'elevage', name: 'Élevage de canards - Foie gras - Labeyrie', url: '' },
  { year: 2012, site: 'elevage', name: 'Élevage de poules', url: 'https://www.l214.com/oeufs-poules-pondeuses/enquete-fevrier-2012' },
  { year: 2013, site: 'transport', name: 'Transport des chevreaux', url: 'https://www.l214.com/video/transport-chevreaux-abattoir-mars-2013' },
  { year: 2014, site: 'elevage', name: 'Campagne anti-fourrure', url: 'http://victimes-de-la-mode.org/' },
  { year: 2014, site: 'transport', name: 'Transport et abattage de chevaux (d’Amérique)', url: 'https://www.l214.com/le-calvaire-des-chevaux-en-amerique' },
  { year: 2014, site: 'elevage', name: 'Élevage de lapins', url: 'https://www.l214.com/enquetes/message-matthieu-ricard-lapins/' },
  { year: 2014, site: 'elevage', name: 'Élevage de poules - Super U', url: 'https://www.l214.com/enquetes/super-u-maltraite-les-poules-pondeuses/' },
  { year: 2015, site: 'elevage', name: 'Centre d’insémination - La fabrique des canards mulards', url: '' },
  { year: 2017, site: 'transport', name: 'Transport d’animaux - France, Liban, Turquie', url: '' },
  { year: 2018, site: 'elevage', name: 'Élevage de dindes', url: '' },
  { year: 2025, site: 'elevage', name: 'Enquêtes au drone - Élevages', url: '' },
  { year: 2026, site: 'abattoir', name: 'Abattoir du Lamentin - Martinique', url: 'https://www.l214.com/enquetes/2026/abattoir-martinique/' },
];
