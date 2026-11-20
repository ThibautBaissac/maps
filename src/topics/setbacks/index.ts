// Subject setbacks: which towers of the square rise in steps, by building period.
import { formatDate, formatNumber, messages } from '../../i18n/index.ts';
import type { TopicDef, TopicMark } from '../types.ts';
import { analyseSetbacks, type SetbackEvidence, type Tower } from './evidence.ts';

export interface SetbackTopic extends SetbackEvidence {
  id: 'setbacks';
  /** Two stepped towers of 1916–1960, then a block tower of 1961 or later. */
  places: (TopicMark & { tower: Tower })[];
}

export const setbacks: TopicDef<SetbackTopic> = {
  themes: ['architecture', 'history'],
  /** Numbered references: the two tallest named stepped towers of 1916–1960, apart, then the tallest named block tower of 1961 or later. */
  analyse({ half }, layers) {
    const evidence = analyseSetbacks(layers, half);
    const named = evidence.towers.filter((t) => t.name);
    const chosen: Tower[] = [];
    for (const t of named) {
      if (t.period !== 'zoning-1916' || t.form !== 'stepped') continue;
      if (chosen.every((c) => Math.hypot(t.point[0] - c.point[0], t.point[1] - c.point[1]) > half * 0.3)) chosen.push(t);
      if (chosen.length === 2) break;
    }
    const block = named.find((t) => t.period === 'zoning-1961' && t.form === 'block');
    if (block) chosen.push(block);
    return { id: 'setbacks', ...evidence, places: chosen.map((tower) => ({ name: tower.name!, point: tower.point, tower })) };
  },
  content(survey, topic, locale) {
    const text = messages(locale), copy = text.topic, subject = text.topics[topic.id], c = subject;
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
  },
};
