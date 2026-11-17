import { isShown, parseTag } from './selection.ts';
import { enhanceLanguageMenu } from '../languages.ts';

enhanceLanguageMenu();

// The gallery content is rendered in its language at build time. A missing picture
// leaves the style's paper and dot pattern visible, as it did before localization.
for (const img of document.querySelectorAll<HTMLImageElement>('.strip img')) {
  const remove = (): void => img.remove();
  img.addEventListener('error', remove);
  if (img.complete && !img.naturalWidth) remove();
}

// Filters: one tag at a time, kept in ?tag= so a selection can be shared and survives
// the way back from a map. Without this script the row stays hidden and all maps show.

const filters = document.querySelector<HTMLElement>('.filters');
if (filters) {
  const buttons = [...filters.querySelectorAll<HTMLButtonElement>('button[data-tag]')];
  const strips = [...document.querySelectorAll<HTMLElement>('.strip')].map((el) => ({ el, tags: (el.dataset['tags'] ?? '').split(' ') }));
  const status = filters.querySelector<HTMLElement>('.filter-count');
  const lang = document.documentElement.lang;
  const forms = JSON.parse(status?.dataset['forms'] ?? '{}') as Partial<Record<Intl.LDMLPluralRule, string>>;
  const announce = (count: number): string => (forms[new Intl.PluralRules(lang).select(count)] ?? forms.other ?? '')
    .replaceAll('{count}', new Intl.NumberFormat(lang).format(count));

  const select = (tag: string | null, announced: boolean): void => {
    let shown = 0;
    for (const { el, tags } of strips) {
      el.hidden = !isShown(tags, tag);
      if (!el.hidden) shown += 1;
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String((button.dataset['tag'] || null) === tag));
    // Announced only after a choice, not on load.
    if (status) status.textContent = announced ? announce(shown) : '';
    const url = new URL(location.href);
    if (tag) url.searchParams.set('tag', tag); else url.searchParams.delete('tag');
    history.replaceState(history.state, '', url);
  };

  filters.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-tag]');
    if (button) select(button.dataset['tag'] || null, true);
  });
  const initial = parseTag(location.search, buttons.map((b) => b.dataset['tag'] ?? '').filter(Boolean));
  if (initial) select(initial, false);
  filters.hidden = false;
}
