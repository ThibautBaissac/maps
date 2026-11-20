// Subject investigations: where L214's published investigations took place in France.
import { formatDate, formatNumber, messages, pluralText } from '../../i18n/index.ts';
import { UNLOCATED_INVESTIGATIONS } from '../../../places/investigations.ts';
import type { TopicDef, TopicMark } from '../types.ts';
import { MESSAGES } from './messages.ts';
import { analyseInvestigations, type InvestigationEvidence } from './evidence.ts';

export interface InvestigationTopic extends InvestigationEvidence {
  id: 'investigations';
  /** The three départements with the most investigations placed on the map, apart. */
  places: (TopicMark & { code: string; count: number })[];
}

export { MESSAGES as messages };

export const topic: TopicDef<InvestigationTopic> = {
  /** Numbered references: the départements with the most investigations, at least a tenth of the square apart. */
  analyse({ half }, layers) {
    const evidence = analyseInvestigations(layers, UNLOCATED_INVESTIGATIONS);
    const ranked = evidence.departements.map((d) => ({ d, count: evidence.byDepartement.get(d.code) ?? 0 }))
      .filter(({ count }) => count > 0)
      .sort((a, b) => b.count - a.count || a.d.code.localeCompare(b.d.code));
    const places: InvestigationTopic['places'] = [];
    for (const { d, count } of ranked) {
      if (places.every((p) => Math.hypot(p.point[0] - d.centre[0], p.point[1] - d.centre[1]) > half * 0.1)) {
        places.push({ name: d.name, point: d.centre, code: d.code, count });
      }
      if (places.length === 3) break;
    }
    return { id: 'investigations', ...evidence, places };
  },
  content(survey, topic, locale) {
    const copy = messages(locale).topic, subject = MESSAGES[locale], c = subject;
    const n = (v: number): string => formatNumber(locale, v);
    const located = topic.investigations.length, total = located + topic.unlocated.length;
    const top = topic.regions[0];
    return {
      copy, subject,
      value: `${n(located)} / ${n(total)}`,
      concentration: top && located ? c.concentration(top.name, n(Math.round(top.count / located * 100))) : c.empty,
      source: c.source(formatDate(locale, survey.osmDate)),
      references: topic.places.map((p, index) => {
        const years = topic.investigations.filter((i) => i.departement === p.code).map((i) => i.year);
        const span = Math.min(...years) === Math.max(...years) ? String(Math.min(...years)) : `${Math.min(...years)}–${Math.max(...years)}`;
        return { number: index + 1, name: p.name, point: p.point, detail: `${pluralText(locale, c.count, p.count)} · ${span}` };
      }),
      distribution: {
        title: c.distribution, help: c.distributionHelp, layout: 'list',
        rows: topic.regions.map((r, i) => ({ name: r.name, value: pluralText(locale, c.count, r.count), strongest: i === 0 })),
      },
      notes: {
        title: c.unlocated, help: c.unlocatedHelp,
        items: topic.unlocated.map((u) => `${u.year} · ${c.sites[u.site]} · ${u.name}`),
      },
      dataFile: c.dataFile,
      panelLegend: false,
    };
  },
};
