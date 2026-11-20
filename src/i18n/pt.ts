import { addMessages } from './index.ts';
import type { Messages } from './types.ts';

// European Portuguese (pt-PT): the register of the Lisbon map's own city.
export const pt: Messages = {
  languageName: 'Português',
  languageNav: 'Idioma',
  attribution: '© colaboradores do OpenStreetMap',
  data: 'Dados',
  gallery: {
    title: 'Mapas ilustrados',
    heading: ['Escolhe um bairro.', 'Perde-te nele.'],
    description: (places) => `Plantas de bairros desenhadas com código, cada uma no seu estilo gráfico: ${places}.`,
    maps: 'Mapas',
    /** The places left out of a list cut short, as its last item. */
    more: { one: 'mais {count}', other: 'mais {count}' },
    open: 'Abrir o mapa',
    shown: { one: '{count} mapa apresentado', other: '{count} mapas apresentados' },
    search: 'Pesquisar',
    searchHint: 'Pesquisar: cidade, estilo, tema…',
    noMatch: 'Nenhum mapa corresponde.',
    reset: 'Mostrar todos',
  },
  map: {
    description: (title, district, style) => `Planta ilustrada de ${title} (${district}), estilo ${style}.`,
    label: (title, district) => `Planta ilustrada: ${title}, ${district}. Usa os botões de zoom, a roda do rato ou as teclas mais e menos para ampliar ou reduzir; arrasta ou usa as setas para te deslocares.`,
    summaryHelp: 'Consulta o botão Descrição para aceder ao conteúdo textual da planta.',
    loading: 'A carregar a planta…',
    back: 'Todos os mapas',
    zoom: 'Zoom da planta',
    zoomIn: 'Ampliar a planta (+)',
    zoomOut: 'Reduzir a planta (−)',
    descriptionButton: 'Descrição',
    descriptionTitle: 'Descrição da planta',
    close: 'Fechar',
    error: 'Não foi possível carregar a planta. Verifica a ligação e tenta de novo.',
    retry: 'Tentar de novo',
  },
  description: {
    overview: (title, district, size) => `${title}, ${district}. Área quadrada com ${size} km de lado. O norte está em cima.`,
    help: 'Consulta o botão Descrição para ver a legenda e as ruas e águas com nome.',
    centre: (lat, lon, date) => `Centro: latitude ${lat}°, longitude ${lon}°. Dados do OpenStreetMap atualizados a ${date}.`,
    counts: (b, r, p, w) => `Conteúdo do extrato do OpenStreetMap: ${b}, ${r}, ${p} e ${w}.`,
    features: [
      { one: '{count} edifício', other: '{count} edifícios' },
      { one: '{count} troço de via', other: '{count} troços de vias' },
      { one: '{count} espaço verde', other: '{count} espaços verdes' },
      { one: '{count} superfície de água', other: '{count} superfícies de água' },
    ],
    legend: 'Legenda',
    positionsHelp: 'As posições indicam um setor aproximado em relação ao centro da planta. Descrevem toda a área, independentemente do zoom.',
    positions: [['a sudoeste', 'a sul', 'a sudeste'], ['a oeste', 'no centro', 'a leste'], ['a noroeste', 'a norte', 'a nordeste']],
    roads: 'Ruas e vias com nome',
    water: 'Massas e cursos de água com nome',
    empty: 'Nenhum elemento com nome nesta área.',
    unnamed: { one: '{count} elemento sem nome, visível no mapa.', other: '{count} elementos sem nome, visíveis no mapa.' },
  },
  canvas: {
    legend: 'LEGENDA',
    items: ['EDIFÍCIOS', 'RUAS E CAIS', 'ÁGUA', 'PARQUES E JARDINS'],
    work: 'PROJETO',
    kind: 'PLANTA DO BAIRRO',
    sheet: 'FOLHA 01 / 01',
    scale: 'ESCALA',
    survey: (date) => `DADOS OSM ${date}`,
    north: 'N', south: 'S', east: 'E', west: 'O',
  },
  topic: {
    eyebrow: 'Compreender o lugar',
    references: 'Referências com nome',
    referenceHelp: 'Os números correspondem às referências do mapa. Seleciona um nome para o localizar.',
    methodology: 'Fontes e método',
    empty: 'Os dados do OpenStreetMap não contêm elementos correspondentes a este tema nesta área.',
    overview: 'Voltar à vista geral',
    focus: (name) => `Centrar o mapa em ${name}`,
    referenceLine: (number, name, detail) => `${number}. ${name}: ${detail}`,
    source: (date, size) => `Dados do OpenStreetMap atualizados a ${date}. Quadrado com ${size} km de lado centrado no lugar; pode ultrapassar os limites do bairro.`,
    dataFile: 'Consultar os dados do OpenStreetMap (JSON)',
  },
  places: {
    'amsterdam-centre': { name: 'Amesterdão', district: 'Centro histórico' },
    france: { name: 'França', district: 'França metropolitana' },
    'lisbonne-alfama': { name: 'Lisboa', district: 'Alfama' },
    'londres-soho': { name: 'Londres', district: 'Soho' },
    'new-york-midtown': { name: 'Nova Iorque', district: 'Midtown' },
  },
  themes: {
    water: 'Água',
    relief: 'Relevo',
    history: 'História',
    health: 'Saúde',
    architecture: 'Arquitetura',
    animals: 'Animais',
  },
  styles: {
    dossier: {
      label: 'Mapa de processo',
      legend: ['País: contorno a tinta, departamentos e grandes rios a cinzento.', 'Marcas vermelhas: a forma indica o tipo de local (quadrado, disco, triângulo).', 'Tracejado vermelho: denso para um departamento, espaçado para uma região, quando não se conhece o município.', 'Ficha agrafada: legenda e lista das investigações sem local.'],
    },
    'art-deco': {
      label: 'Cartaz art déco em relevo',
      legend: ['Edifícios: volumes em relevo à altura do OSM.', 'Ruas: faixas claras entre os volumes.', 'Água: cor lisa azul-noite.', 'Parques e jardins: cor lisa verde.'],
    },
    'gravure-sepia': {
      label: 'Gravura antiga sépia',
      legend: ['Edifícios: tracejado oblíquo, mais denso do lado da sombra.', 'Ruas: traço duplo fino para as grandes vias, traço simples para as restantes.', 'Água: linhas onduladas.', 'Parques e jardins: pontilhado e pequenas árvores.'],
    },
    riso: {
      label: 'Risografia a duas tintas',
      legend: ['Edifícios: superfícies cheias.', 'Ruas e cais: linhas.', 'Água: tracejado horizontal.', 'Parques e jardins: trama de pontos.'],
    },
    cyanotype: {
      label: 'Cianotipia de arquiteto',
      legend: ['Edifícios: contornos.', 'Ruas: linhas simples ou duplas consoante o zoom.', 'Água: tom uniforme e linha de margem, sem informação de profundidade.', 'Parques e jardins: tracejado cruzado.'],
    },
  },
};

addMessages('pt', pt);
