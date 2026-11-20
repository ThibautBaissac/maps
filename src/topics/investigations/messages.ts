// The texts of the investigations subject in every language. metric, legend, method and limits are
// its facts and method in the plain house style, shared by every map of it (TopicFacts);
// the other strings serve its panel, its legend and its text description.
import type { Locale, PluralMessage } from '../../i18n/types.ts';
import type { SiteKind, Species } from './evidence.ts';
import type { TopicFacts } from '../types.ts';

export interface InvestigationMessages extends TopicFacts {
  /** Kinds of site, as row and legend labels. */
  sites: Record<SiteKind, string>;
  /** A number of investigations. */
  count: PluralMessage;
  concentration: (region: string, share: string) => string;
  empty: string;
  distribution: string;
  distributionHelp: string;
  unlocated: string;
  unlocatedHelp: string;
  source: (date: string) => string;
  dataFile: string;
  /** Short legend labels drawn on the map. */
  /** Hatching: only the département, or only the region, is known. */
  legendDepartement: string;
  legendRegion: string;
  /** Animal labels of the detail card. */
  species: Record<Species, string>;
  /** The detail card opened on a mark or a hatched area. */
  card: {
    close: string;
    /** Link to the investigation's page on l214.com. */
    open: string;
    /** Where: town and département, département only, or region only. */
    commune: (commune: string, departement: string) => string;
    departement: (departement: string) => string;
    region: (region: string) => string;
    /** Heading of the list in a hatched area. */
    area: (name: string) => string;
  };
  /** The numbered circles: départements with the most investigations. */
  legendReferences: string;
  /** The grey context of the base map. */
  legendContext: string;
  /** Heading of the margin list drawn on the map. */
  margin: string;
}

export const MESSAGES: Record<Locale, InvestigationMessages> = {
  fr: {
    metric: 'enquêtes situées sur la carte, sur l’ensemble du relevé',
    legend: 'Carré rouge : abattoir. Disque rouge : élevage. Triangle rouge : couvoir, transport ou autre site. Chaque marque désigne la commune de l’enquête. Hachures rouges serrées : département d’une enquête dont la page ne nomme pas la commune ; hachures espacées : région, quand seule la région est connue. Cercles numérotés : départements qui comptent le plus d’enquêtes. Traits gris : limites des départements et grands cours d’eau.',
    method: 'Chaque enquête de la base de L214 publiée depuis 2008, année de création de l’association, est située d’après sa fiche : commune du site quand elle est indiquée, sinon département ou région ; quelques communes viennent de la page publique de l’enquête. Les communes sont placées à leur centre selon geo.api.gouv.fr. Une enquête menée sur plusieurs sites situés séparément compte une fois par site ; ses sites sans lieu sont cités une seule fois. L’année est celle de la publication.',
    limits: 'La répartition reflète l’accès aux lieux et les lanceurs d’alerte, pas la fréquence des mauvais traitements. Une marque situe une commune, pas l’adresse du site. Les titres restent en français. La projection, simple et centrée sur la France, déforme un peu les bords. L’outre-mer n’est pas représenté.',
    sites: { abattoir: 'Abattoir', elevage: 'Élevage', couvoir: 'Couvoir', transport: 'Transport', autre: 'Autre site' },
    count: { one: '{count} enquête', other: '{count} enquêtes' },
    concentration: (region, share) => `Région ${region} : ${share} % des enquêtes situées sur la carte.`,
    empty: 'Aucune enquête du relevé n’est située en France métropolitaine.',
    distribution: 'Enquêtes situées, par région',
    distributionHelp: 'Une enquête située seulement au département ou à la région compte dans sa région. Les enquêtes sans lieu ne figurent pas dans ce décompte.',
    unlocated: 'Enquêtes sans lieu sur la carte',
    unlocatedHelp: 'Leur page ne situe aucun site en France métropolitaine : transports, pêche en mer, sites non nommés, outre-mer ou étranger.',
    source: (date) => `Base des enquêtes de L214, arrêtée au ${date} ; chaque lieu tiré de la fiche de l’enquête, parfois précisé par sa page publique. Fond : départements IGN Admin Express (Licence Ouverte), cours d’eau Natural Earth (domaine public).`,
    dataFile: 'Consulter les enquêtes situées (JSON)',
    legendDepartement: 'Seul le département est connu',
    legendRegion: 'Seule la région est connue',
    species: { bovins: 'Bovins', veaux: 'Veaux', cochons: 'Cochons', poulets: 'Poulets', poules: 'Poules', dindes: 'Dindes', canards: 'Canards', cailles: 'Cailles', pintades: 'Pintades', lapins: 'Lapins', moutons: 'Moutons', chevres: 'Chèvres', chevaux: 'Chevaux', poissons: 'Poissons', visons: 'Visons', cerfs: 'Cerfs', faisans: 'Faisans', poussins: 'Poussins', oies: 'Oies', chiens: 'Chiens', autres: 'Autres animaux' },
    card: { close: 'Fermer', open: 'Voir l’enquête sur l214.com', commune: (commune, departement) => `${commune} (${departement})`, departement: (departement) => `Département : ${departement} (commune non précisée)`, region: (region) => `Région : ${region} (lieu non précisé)`, area: (name) => `${name} : enquêtes sans commune précisée` },
    legendReferences: 'Départements aux plus d’enquêtes',
    legendContext: 'Départements, grands cours d’eau',
    margin: 'SANS LIEU SUR LA CARTE',
  },
  en: {
    metric: 'investigations placed on the map, out of the whole register',
    legend: 'Red square: slaughterhouse. Red disc: farm. Red triangle: hatchery, transport or other site. Each mark stands for the town of the investigation. Dense red hatching: department of an investigation whose page does not name the town; sparse hatching: region, when only the region is known. Numbered circles: departments with the most investigations. Grey lines: department boundaries and main rivers.',
    method: 'Each investigation in L214’s database published since 2008, the year the association was founded, is located from its record: the town of the site when given, otherwise the department or region; a few towns come from the investigation’s public page. Towns are placed at their centre according to geo.api.gouv.fr. An investigation carried out at several separately located sites counts once per site; its sites without a place are cited once. The year is the year of publication.',
    limits: 'The distribution reflects access to sites and whistleblowers, not how often animals are mistreated. A mark locates a town, not the address of the site. Titles stay in French. The simple projection, centred on France, slightly distorts the edges. Overseas France is not shown.',
    sites: { abattoir: 'Slaughterhouse', elevage: 'Farm', couvoir: 'Hatchery', transport: 'Transport', autre: 'Other site' },
    count: { one: '{count} investigation', other: '{count} investigations' },
    concentration: (region, share) => `${region}: ${share}% of the investigations placed on the map.`,
    empty: 'No investigation of the register is located in metropolitan France.',
    distribution: 'Investigations placed on the map, by region',
    distributionHelp: 'An investigation located only to its department or region counts in its region. Investigations without a place are not counted here.',
    unlocated: 'Investigations without a place on the map',
    unlocatedHelp: 'Their page locates no site in metropolitan France: transport, fishing at sea, unnamed sites, overseas France or abroad.',
    source: (date) => `L214’s investigations database, as of ${date}; each place taken from the investigation’s record, sometimes refined from its public page. Base map: IGN Admin Express departments (Licence Ouverte), Natural Earth rivers (public domain).`,
    dataFile: 'View the located investigations (JSON)',
    legendDepartement: 'Only the department is known',
    legendRegion: 'Only the region is known',
    species: { bovins: 'Cattle', veaux: 'Calves', cochons: 'Pigs', poulets: 'Chickens', poules: 'Hens', dindes: 'Turkeys', canards: 'Ducks', cailles: 'Quails', pintades: 'Guinea fowl', lapins: 'Rabbits', moutons: 'Sheep', chevres: 'Goats', chevaux: 'Horses', poissons: 'Fish', visons: 'Mink', cerfs: 'Deer', faisans: 'Pheasants', poussins: 'Chicks', oies: 'Geese', chiens: 'Dogs', autres: 'Other animals' },
    card: { close: 'Close', open: 'See the investigation on l214.com', commune: (commune, departement) => `${commune} (${departement})`, departement: (departement) => `Department: ${departement} (town not given)`, region: (region) => `Region: ${region} (place not given)`, area: (name) => `${name}: investigations with no town given` },
    legendReferences: 'Departments with most investigations',
    legendContext: 'Departments, main rivers',
    margin: 'NO PLACE ON THE MAP',
  },
  es: {
    metric: 'investigaciones situadas en el mapa, sobre el total del registro',
    legend: 'Cuadrado rojo: matadero. Disco rojo: granja. Triángulo rojo: incubadora, transporte u otro lugar. Cada marca señala el municipio de la investigación. Rayado rojo denso: departamento de una investigación cuya página no nombra el municipio; rayado espaciado: región, cuando solo se conoce la región. Círculos numerados: departamentos con más investigaciones. Trazos grises: límites de los departamentos y grandes ríos.',
    method: 'Cada investigación de la base de L214 publicada desde 2008, año de creación de la asociación, se sitúa según su ficha: el municipio del lugar cuando se indica; si no, el departamento o la región; algunos municipios proceden de la página pública de la investigación. Los municipios se colocan en su centro según geo.api.gouv.fr. Una investigación realizada en varios lugares situados por separado cuenta una vez por lugar; sus lugares sin ubicar se citan una sola vez. El año es el de la publicación.',
    limits: 'La distribución refleja el acceso a los lugares y a los denunciantes, no la frecuencia del maltrato. Una marca sitúa un municipio, no la dirección del lugar. Los títulos se mantienen en francés. La proyección, simple y centrada en Francia, deforma un poco los bordes. La Francia de ultramar no está representada.',
    sites: { abattoir: 'Matadero', elevage: 'Granja', couvoir: 'Incubadora', transport: 'Transporte', autre: 'Otro lugar' },
    count: { one: '{count} investigación', other: '{count} investigaciones' },
    concentration: (region, share) => `${region}: ${share} % de las investigaciones situadas en el mapa.`,
    empty: 'Ninguna investigación del registro está situada en la Francia metropolitana.',
    distribution: 'Investigaciones situadas, por región',
    distributionHelp: 'Una investigación situada solo en su departamento o región cuenta en su región. Las investigaciones sin lugar no figuran en este recuento.',
    unlocated: 'Investigaciones sin lugar en el mapa',
    unlocatedHelp: 'Su página no sitúa ningún lugar en la Francia metropolitana: transportes, pesca en el mar, lugares sin nombre, ultramar o extranjero.',
    source: (date) => `Base de investigaciones de L214, a fecha de ${date}; cada lugar tomado de la ficha de la investigación, a veces precisado por su página pública. Fondo: departamentos IGN Admin Express (Licence Ouverte), ríos Natural Earth (dominio público).`,
    dataFile: 'Consultar las investigaciones situadas (JSON)',
    legendDepartement: 'Solo se conoce el departamento',
    legendRegion: 'Solo se conoce la región',
    species: { bovins: 'Bovinos', veaux: 'Terneros', cochons: 'Cerdos', poulets: 'Pollos', poules: 'Gallinas', dindes: 'Pavos', canards: 'Patos', cailles: 'Codornices', pintades: 'Pintadas', lapins: 'Conejos', moutons: 'Ovejas', chevres: 'Cabras', chevaux: 'Caballos', poissons: 'Peces', visons: 'Visones', cerfs: 'Ciervos', faisans: 'Faisanes', poussins: 'Pollitos', oies: 'Ocas', chiens: 'Perros', autres: 'Otros animales' },
    card: { close: 'Cerrar', open: 'Ver la investigación en l214.com', commune: (commune, departement) => `${commune} (${departement})`, departement: (departement) => `Departamento: ${departement} (municipio no indicado)`, region: (region) => `Región: ${region} (lugar no indicado)`, area: (name) => `${name}: investigaciones sin municipio indicado` },
    legendReferences: 'Departamentos con más investigaciones',
    legendContext: 'Departamentos, ríos principales',
    margin: 'SIN LUGAR EN EL MAPA',
  },
  pt: {
    metric: 'investigações situadas no mapa, no total do registo',
    legend: 'Quadrado vermelho: matadouro. Disco vermelho: exploração. Triângulo vermelho: incubadora, transporte ou outro local. Cada marca assinala o município da investigação. Tracejado vermelho denso: departamento de uma investigação cuja página não indica o município; tracejado espaçado: região, quando só se conhece a região. Círculos numerados: departamentos com mais investigações. Traços cinzentos: limites dos departamentos e grandes rios.',
    method: 'Cada investigação da base da L214 publicada desde 2008, ano de criação da associação, é situada a partir da sua ficha: o município do local quando é indicado; caso contrário, o departamento ou a região; alguns municípios vêm da página pública da investigação. Os municípios são colocados no seu centro segundo geo.api.gouv.fr. Uma investigação feita em vários locais situados separadamente conta uma vez por local; os seus locais sem localização são citados uma só vez. O ano é o da publicação.',
    limits: 'A distribuição reflete o acesso aos locais e aos denunciantes, não a frequência dos maus-tratos. Uma marca situa um município, não a morada do local. Os títulos ficam em francês. A projeção, simples e centrada em França, deforma um pouco as margens. A França ultramarina não está representada.',
    sites: { abattoir: 'Matadouro', elevage: 'Exploração', couvoir: 'Incubadora', transport: 'Transporte', autre: 'Outro local' },
    count: { one: '{count} investigação', other: '{count} investigações' },
    concentration: (region, share) => `${region}: ${share} % das investigações situadas no mapa.`,
    empty: 'Nenhuma investigação do registo está situada na França metropolitana.',
    distribution: 'Investigações situadas, por região',
    distributionHelp: 'Uma investigação situada apenas no seu departamento ou região conta na sua região. As investigações sem local não entram nesta contagem.',
    unlocated: 'Investigações sem local no mapa',
    unlocatedHelp: 'A sua página não situa nenhum local na França metropolitana: transportes, pesca no mar, locais sem nome, ultramar ou estrangeiro.',
    source: (date) => `Base de investigações da L214, à data de ${date}; cada local retirado da ficha da investigação, por vezes precisado pela sua página pública. Fundo: departamentos IGN Admin Express (Licence Ouverte), rios Natural Earth (domínio público).`,
    dataFile: 'Consultar as investigações situadas (JSON)',
    legendDepartement: 'Só se conhece o departamento',
    legendRegion: 'Só se conhece a região',
    species: { bovins: 'Bovinos', veaux: 'Vitelos', cochons: 'Porcos', poulets: 'Frangos', poules: 'Galinhas', dindes: 'Perus', canards: 'Patos', cailles: 'Codornizes', pintades: 'Galinhas-d’angola', lapins: 'Coelhos', moutons: 'Ovelhas', chevres: 'Cabras', chevaux: 'Cavalos', poissons: 'Peixes', visons: 'Visons', cerfs: 'Veados', faisans: 'Faisões', poussins: 'Pintos', oies: 'Gansos', chiens: 'Cães', autres: 'Outros animais' },
    card: { close: 'Fechar', open: 'Ver a investigação em l214.com', commune: (commune, departement) => `${commune} (${departement})`, departement: (departement) => `Departamento: ${departement} (município não indicado)`, region: (region) => `Região: ${region} (local não indicado)`, area: (name) => `${name}: investigações sem município indicado` },
    legendReferences: 'Departamentos com mais investigações',
    legendContext: 'Departamentos, rios principais',
    margin: 'SEM LOCAL NO MAPA',
  },
  de: {
    metric: 'Recherchen auf der Karte verortet, vom gesamten Verzeichnis',
    legend: 'Rotes Quadrat: Schlachthof. Rote Scheibe: Tierhaltung. Rotes Dreieck: Brüterei, Transport oder anderer Ort. Jede Markierung steht für die Gemeinde der Recherche. Dichte rote Schraffur: Département einer Recherche, deren Seite die Gemeinde nicht nennt; weite Schraffur: Region, wenn nur die Region bekannt ist. Nummerierte Kreise: Départements mit den meisten Recherchen. Graue Linien: Grenzen der Départements und große Flüsse.',
    method: 'Jede seit 2008, dem Gründungsjahr des Vereins, veröffentlichte Recherche der L214-Datenbank ist nach ihrem Eintrag verortet: die Gemeinde des Ortes, wenn angegeben, sonst Département oder Region; einige Gemeinden stammen von der öffentlichen Seite der Recherche. Gemeinden liegen auf ihrem Mittelpunkt nach geo.api.gouv.fr. Eine Recherche an mehreren getrennt verorteten Orten zählt einmal je Ort; ihre Orte ohne Angabe werden einmal genannt. Das Jahr ist das der Veröffentlichung.',
    limits: 'Die Verteilung spiegelt den Zugang zu den Orten und die Hinweisgeber, nicht die Häufigkeit von Misshandlungen. Eine Markierung verortet eine Gemeinde, nicht die Adresse des Betriebs. Die Titel bleiben auf Französisch. Die einfache, auf Frankreich zentrierte Projektion verzerrt die Ränder leicht. Die Überseegebiete sind nicht dargestellt.',
    sites: { abattoir: 'Schlachthof', elevage: 'Tierhaltung', couvoir: 'Brüterei', transport: 'Transport', autre: 'Anderer Ort' },
    count: { one: '{count} Recherche', other: '{count} Recherchen' },
    concentration: (region, share) => `${region}: ${share} % der auf der Karte verorteten Recherchen.`,
    empty: 'Keine Recherche des Verzeichnisses liegt im europäischen Frankreich.',
    distribution: 'Verortete Recherchen nach Region',
    distributionHelp: 'Eine nur auf Département oder Region genau verortete Recherche zählt in ihrer Region. Recherchen ohne Ort sind hier nicht mitgezählt.',
    unlocated: 'Recherchen ohne Ort auf der Karte',
    unlocatedHelp: 'Ihre Seite nennt keinen Ort im europäischen Frankreich: Transporte, Fischerei auf See, ungenannte Betriebe, Überseegebiete oder Ausland.',
    source: (date) => `Recherchen-Datenbank von L214, Stand ${date}; jeder Ort dem Eintrag der Recherche entnommen, teils nach ihrer öffentlichen Seite präzisiert. Grundkarte: Départements IGN Admin Express (Licence Ouverte), Flüsse Natural Earth (gemeinfrei).`,
    dataFile: 'Verortete Recherchen ansehen (JSON)',
    legendDepartement: 'Nur das Département ist bekannt',
    legendRegion: 'Nur die Region ist bekannt',
    species: { bovins: 'Rinder', veaux: 'Kälber', cochons: 'Schweine', poulets: 'Masthühner', poules: 'Legehennen', dindes: 'Puten', canards: 'Enten', cailles: 'Wachteln', pintades: 'Perlhühner', lapins: 'Kaninchen', moutons: 'Schafe', chevres: 'Ziegen', chevaux: 'Pferde', poissons: 'Fische', visons: 'Nerze', cerfs: 'Hirsche', faisans: 'Fasane', poussins: 'Küken', oies: 'Gänse', chiens: 'Hunde', autres: 'Andere Tiere' },
    card: { close: 'Schließen', open: 'Recherche auf l214.com ansehen', commune: (commune, departement) => `${commune} (${departement})`, departement: (departement) => `Département: ${departement} (Gemeinde nicht genannt)`, region: (region) => `Region: ${region} (Ort nicht genannt)`, area: (name) => `${name}: Recherchen ohne genannte Gemeinde` },
    legendReferences: 'Départements mit den meisten Recherchen',
    legendContext: 'Départements, große Flüsse',
    margin: 'OHNE ORT AUF DER KARTE',
  },
};
