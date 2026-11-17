import { formatDate, formatNumber, messages, type Locale } from './i18n/index.ts';
import type { Survey } from './layers.ts';
import type { Point } from './toolkit/geometry.ts';
import type { CholeraTopic, LinearTopic, TopicAnalysis } from './topics.ts';

export interface TopicRow { name: string; value: string; strongest: boolean }

/** One interpretation of the measurements for the sidebar and the text equivalent. */
export interface TopicContent {
  copy: ReturnType<typeof messages>['topic'];
  subject: ReturnType<typeof messages>['topics'][TopicAnalysis['id']];
  value: string;
  concentration: string;
  source: string;
  references: { number: number; name: string; point: Point; detail: string }[];
  distribution: { title: string; help: string; layout: 'grid' | 'list'; rows: TopicRow[] };
}

export function topicContent(survey: Survey, topic: TopicAnalysis, locale: Locale): TopicContent {
  return topic.id === 'cholera-pump' ? choleraContent(survey, topic, locale) : linearContent(survey, topic, locale);
}

function linearContent(survey: Survey, topic: LinearTopic, locale: Locale): TopicContent {
  const text = messages(locale), copy = text.topic, subject = text.topics[topic.id];
  const positions = text.description.positions.flat();
  const metres = (n: number): string => formatNumber(locale, Math.round(n), { maximumFractionDigits: 0 });
  const strongest = topic.sectors.reduce((best, sector, i, all) => sector.length > all[best]!.length ? i : best, 0);
  const share = topic.length ? Math.round(topic.sectors[strongest]!.length / topic.length * 100) : 0;
  return {
    copy, subject,
    value: `≈ ${metres(topic.length >= 100 ? Math.round(topic.length / 10) * 10 : topic.length)} m`,
    concentration: topic.length ? copy.concentration(positions[strongest]!, String(share)) : copy.empty,
    source: copy.source(formatDate(locale, survey.fetchedAt), formatNumber(locale, survey.sizeKm)),
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

function choleraContent(survey: Survey, topic: CholeraTopic, locale: Locale): TopicContent {
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
    source: `${c.source} ${copy.source(formatDate(locale, survey.fetchedAt), formatNumber(locale, survey.sizeKm))}`,
    references: topic.places.map((p, index) => ({
      number: index + 1,
      name: p.kind === 'pump' ? c.broadPump : c[p.kind],
      point: p.point,
      detail: p.kind === 'pump' ? c.pumpDetail(n(topic.broad), n(topic.within100)) : c[`${p.kind}Detail`],
    })),
    distribution: { title: c.distribution, help: c.distributionHelp, layout: 'list', rows },
  };
}
