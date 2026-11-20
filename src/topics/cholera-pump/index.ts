// Subject cholera-pump: the 1854 Broad Street outbreak, deaths by nearest pump on foot.
import { formatDate, formatNumber, messages } from '../../i18n/index.ts';
import type { TopicDef, TopicMark } from '../types.ts';
import { analyseCholera, type CholeraEvidence } from './evidence.ts';

export interface CholeraTopic extends CholeraEvidence {
  id: 'cholera-pump';
  /** The Broad Street pump, then Snow's landmarks. */
  places: (TopicMark & { kind: 'pump' | 'workhouse' | 'brewery' })[];
}

export const choleraPump: TopicDef<CholeraTopic> = {
  themes: ['history', 'health', 'water'],
  analyse(_survey, layers) {
    const evidence = analyseCholera(layers);
    const broad = evidence.pumps.find((p) => p.broad);
    return {
      id: 'cholera-pump', ...evidence,
      places: [
        ...(broad ? [{ name: broad.name, point: broad.point, kind: 'pump' as const }] : []),
        ...[...evidence.landmarks].sort((a, b) => a.kind.localeCompare(b.kind)),
      ],
    };
  },
  content(survey, topic, locale) {
    const text = messages(locale), copy = text.topic, subject = text.topics[topic.id], c = subject;
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
  },
};
