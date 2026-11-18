import { formatDate, formatNumber, messages, type Locale, type MapStory } from './i18n/index.ts';
import type { Survey } from './layers.ts';
import type { Point } from './toolkit/geometry.ts';
import type { CholeraTopic, LinearTopic, SetbackTopic, TopicAnalysis } from './topics.ts';

export interface TopicRow { name: string; value: string; strongest: boolean }

/** One interpretation of the measurements for the sidebar and the text equivalent. */
export interface TopicContent {
  copy: ReturnType<typeof messages>['topic'];
  subject: ReturnType<typeof messages>['topics'][TopicAnalysis['id']];
  /** The map's question and intro, in its own voice. */
  story: MapStory;
  value: string;
  concentration: string;
  source: string;
  references: { number: number; name: string; point: Point; detail: string }[];
  distribution: { title: string; help: string; layout: 'grid' | 'list'; rows: TopicRow[] };
}

export function topicContent(survey: Survey, topic: TopicAnalysis, story: MapStory, locale: Locale): TopicContent {
  const content = topic.id === 'cholera-pump' ? choleraContent(survey, topic, locale)
    : topic.id === 'setbacks' ? setbackContent(survey, topic, locale) : linearContent(survey, topic, locale);
  return { story, ...content };
}

function linearContent(survey: Survey, topic: LinearTopic, locale: Locale): Omit<TopicContent, 'story'> {
  const text = messages(locale), copy = text.topic, subject = text.topics[topic.id];
  const positions = text.description.positions.flat();
  const metres = (n: number): string => formatNumber(locale, Math.round(n), { maximumFractionDigits: 0 });
  const strongest = topic.sectors.reduce((best, sector, i, all) => sector.length > all[best]!.length ? i : best, 0);
  const share = topic.length ? Math.round(topic.sectors[strongest]!.length / topic.length * 100) : 0;
  return {
    copy, subject,
    value: `≈ ${metres(topic.length >= 100 ? Math.round(topic.length / 10) * 10 : topic.length)} m`,
    concentration: topic.length ? copy.concentration(positions[strongest]!, String(share)) : copy.empty,
    source: copy.source(formatDate(locale, survey.osmDate), formatNumber(locale, survey.sizeKm)),
    references: topic.places.map((p, index) => ({
      number: index + 1, name: p.name, point: p.point,
      detail: `${positions[p.sector]} · ≈ ${metres(p.length)} m${p.waters.length ? `. ${copy.waterCrossed(p.waters.join(', '))}` : ''}`,
    })),
    distribution: {
      title: copy.distribution, help: copy.distributionHelp, layout: 'grid',
      rows: [6, 7, 8, 3, 4, 5, 0, 1, 2].map((i) => ({
        name: positions[i]!, value: `${metres(topic.sectors[i]!.length)} m`,
        strongest: topic.length > 0 && i === strongest,
      })),
    },
  };
}

function choleraContent(survey: Survey, topic: CholeraTopic, locale: Locale): Omit<TopicContent, 'story'> {
  const text = messages(locale), copy = text.topic, subject = text.topics[topic.id], c = copy.cholera;
  const n = (v: number): string => formatNumber(locale, v);
  const share = topic.total ? Math.round(topic.broad / topic.total * 100) : 0;
  const rows = topic.pumps.map((p) => ({ name: p.broad ? c.broadPump : p.name, value: c.deaths(p.deaths), strongest: p.broad, deaths: p.deaths }))
    .sort((a, b) => b.deaths - a.deaths || a.name.localeCompare(b.name, locale))
    .map(({ deaths: _, ...row }) => row);
  return {
    copy, subject,
    value: `${n(topic.broad)} / ${n(topic.total)}`,
    concentration: topic.total ? c.concentration(String(share), n(topic.within100)) : copy.empty,
    source: `${c.source} ${copy.source(formatDate(locale, survey.osmDate), formatNumber(locale, survey.sizeKm))}`,
    references: topic.places.map((p, index) => ({
      number: index + 1,
      name: p.kind === 'pump' ? c.broadPump : c[p.kind],
      point: p.point,
      detail: p.kind === 'pump' ? c.pumpDetail(n(topic.broad), n(topic.within100)) : c[`${p.kind}Detail`],
    })),
    distribution: { title: c.distribution, help: c.distributionHelp, layout: 'list', rows },
  };
}

function setbackContent(survey: Survey, topic: SetbackTopic, locale: Locale): Omit<TopicContent, 'story'> {
  const text = messages(locale), copy = text.topic, subject = text.topics[topic.id], c = copy.setbacks;
  const n = (v: number): string => formatNumber(locale, v);
  const period = (id: SetbackTopic['periods'][number]['id']) => topic.periods.find((p) => p.id === id)!;
  const share = (p: SetbackTopic['periods'][number]): number => p.detailed ? Math.round(p.stepped / p.detailed * 100) : 0;
  const z1916 = period('zoning-1916'), z1961 = period('zoning-1961');
  const unknown = topic.towers.filter((t) => t.form === 'unknown').length;
  return {
    copy, subject,
    value: `${n(z1916.stepped)} / ${n(z1916.detailed)}`,
    concentration: z1916.detailed && z1961.detailed ? c.concentration(n(share(z1916)), n(share(z1961))) : copy.empty,
    source: `${c.source} ${copy.source(formatDate(locale, survey.osmDate), formatNumber(locale, survey.sizeKm))}`,
    references: topic.places.map(({ tower }, index) => {
      const year = tower.year === undefined ? c.noDate : String(tower.year), height = n(Math.round(tower.top));
      return {
        number: index + 1, name: tower.name ?? '', point: tower.point,
        detail: tower.form === 'stepped' ? c.steppedDetail(year, height, n(tower.levels)) : c.blockDetail(year, height),
      };
    }),
    distribution: {
      title: c.distribution, help: c.distributionHelp(n(unknown)), layout: 'list',
      rows: topic.periods.map((p) => ({ name: c.periods[p.id], value: c.count(n(p.stepped), n(p.detailed)), strongest: p.id === 'zoning-1916' })),
    },
  };
}
