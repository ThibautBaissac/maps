// Every registered map, mounted as its page mounts it: its committed data files, its
// subject's analysis and its style's real mount(), on a fake page (tests/dom.ts). A map
// that a change to the toolkit, a style or a subject breaks fails here by name.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mapsForLocale, type CatalogueMap } from '../src/catalogue.ts';
import { LOCALES } from '../src/i18n/index.ts';
import { mapStory } from '../src/i18n/stories.ts';
import { loadMapData } from '../src/map-meta.ts';
import type { MapHandle, MountArgs } from '../src/styles/contract.ts';
import { contentOf, loadTopic } from '../src/topics/all.ts';
import { installPage, type FakeCanvas } from './dom.ts';

const readPublic = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(new URL(`../public/${path}`, import.meta.url), 'utf8'));

/** A laptop screen at 2× density and a phone, in CSS px. */
const SCREENS = [{ name: 'desktop', width: 1440, height: 900, dpr: 2 }, { name: 'phone', width: 375, height: 700, dpr: 3 }] as const;

const drawn = (canvases: readonly FakeCanvas[]): number => canvases.reduce((n, c) => n + c.calls.length, 0);

async function prepare(map: CatalogueMap) {
  const data = await loadMapData(map, readPublic);
  const subject = await loadTopic(map.topic);
  const topic = subject.analyse(data.survey, data.layers);
  return { data, subject, topic };
}

for (const map of mapsForLocale('fr')) {
  test(`${map.id}: its subject finds evidence in the committed data and explains it in every language`, async () => {
    const { data, subject, topic } = await prepare(map);
    assert.equal(topic.id, map.topic);
    assert.ok(topic.places.length > 0, 'The subject must number at least one reference on the map');
    for (const locale of LOCALES) {
      const story = mapStory(locale, map.id);
      assert.ok(story, `No story in ${locale}`);
      const content = contentOf(subject, data.survey, topic, story, locale);
      assert.ok(content.value.trim() && content.concentration.trim(), `Empty measurement in ${locale}`);
      assert.equal(content.references.length, topic.places.length);
      assert.ok(content.distribution.rows.length > 0, `No distribution rows in ${locale}`);
    }
  });

  for (const screen of SCREENS) {
    test(`${map.id}: mounts on a ${screen.name} screen, then redraws when zoomed and moved`, async (t) => {
      const { data, topic } = await prepare(map);
      const page = installPage(t, screen);
      const { mount } = await map.styleDef.load();
      const args: MountArgs<object> = { container: page.container, meta: data.meta, locale: 'fr', options: map.options, shell: page.shell, layers: data.layers, topic };
      const handle: MapHandle = await (mount as (a: MountArgs<object>) => Promise<MapHandle>)(args);
      page.cleanup(() => handle.destroy());
      assert.ok(page.stage().calls.some((c) => c.method === 'drawImage'), 'The stage must show a render once mount resolves');
      assert.ok(page.placed.length > 0, 'The style must place the page overlays');
      const viewport = handle.viewport;
      if (!viewport || !handle.full) return;
      for (const goal of [{ x: data.survey.half / 3, y: -data.survey.half / 3, s: viewport.view.s * 3 }, { x: 0, y: 0, s: 0 }]) {
        for (const c of page.canvases) c.calls.length = 0;
        viewport.goTo(goal);
        handle.full();
        assert.ok(drawn(page.canvases) > 0, `Nothing redrawn at ${JSON.stringify(goal)}`);
      }
    });
  }
}
