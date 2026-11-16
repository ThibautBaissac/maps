import type { MapData } from './data.ts';
import { formatDate, formatNumber, messages, type Locale } from './i18n/index.ts';
import type { TopicAnalysis } from './topics.ts';

/** One interpretation of the measurements for the sidebar and the text equivalent. */
export function topicContent(data: MapData, topic: TopicAnalysis, locale: Locale) {
  const text = messages(locale), copy = text.topic, subject = text.topics[topic.id];
  const positions = text.description.positions.flat();
  const metres = (n: number): string => formatNumber(locale, Math.round(n), { maximumFractionDigits: 0 });
  const strongest = topic.sectors.reduce((best, sector, i, all) => sector.length > all[best]!.length ? i : best, 0);
  const share = topic.length ? Math.round(topic.sectors[strongest]!.length / topic.length * 100) : 0;
  return {
    copy, subject,
    value: `≈ ${metres(topic.length >= 100 ? Math.round(topic.length / 10) * 10 : topic.length)} m`,
    concentration: topic.length ? copy.concentration(positions[strongest]!, String(share)) : copy.empty,
    source: copy.source(formatDate(locale, data.meta.fetchedAt), formatNumber(locale, data.meta.sizeKm)),
    references: topic.places.map((p, index) => ({
      number: index + 1, name: p.name, point: p.point,
      detail: `${positions[p.sector]} · ≈ ${metres(p.length)} m${p.waters.length ? `. ${copy.waterCrossed(p.waters.join(', '))}` : ''}`,
    })),
    sectors: [6, 7, 8, 3, 4, 5, 0, 1, 2].map((i) => ({
      name: positions[i]!, value: `${metres(topic.sectors[i]!.length)} m`,
      strongest: topic.length > 0 && i === strongest,
    })),
  };
}
