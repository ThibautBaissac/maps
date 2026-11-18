import { isShown, parseTag } from './selection.ts';
import { createSearch, parseQuery, type SearchDocument } from './search.ts';
import { enhanceLanguageMenu } from '../languages.ts';

enhanceLanguageMenu();

// The gallery content is rendered in its language at build time. A missing picture
// leaves the style's paper and dot pattern visible, as it did before localization.
for (const img of document.querySelectorAll<HTMLImageElement>('.strip img')) {
  const remove = (): void => img.remove();
  img.addEventListener('error', remove);
  if (img.complete && !img.naturalWidth) remove();
}

// Search and filters: one tag at a time and a free query, kept in ?tag= and ?q= so a
// selection can be shared and survives the way back from a map. A map is shown when it
// matches both. Without this script the tools stay hidden and all maps show.

const tools = document.querySelector<HTMLElement>('.tools');
const input = document.querySelector<HTMLInputElement>('#map-search');
if (tools && input) {
  const buttons = [...tools.querySelectorAll<HTMLButtonElement>('button[data-tag]')];
  const strips = [...document.querySelectorAll<HTMLElement>('.strip')].map((el) => ({ el, id: el.dataset['id'] ?? '', tags: (el.dataset['tags'] ?? '').split(' ') }));
  const status = tools.querySelector<HTMLElement>('.filter-count');
  const noMatch = document.querySelector<HTMLElement>('.no-match');
  const search = createSearch(JSON.parse(document.getElementById('search-index')?.textContent ?? '[]') as SearchDocument[]);
  const lang = document.documentElement.lang;
  const forms = JSON.parse(status?.dataset['forms'] ?? '{}') as Partial<Record<Intl.LDMLPluralRule, string>>;
  const announce = (count: number): string => (forms[new Intl.PluralRules(lang).select(count)] ?? forms.other ?? '')
    .replaceAll('{count}', new Intl.NumberFormat(lang).format(count));

  let tag: string | null = null;
  let announcement: ReturnType<typeof setTimeout> | undefined;

  /** Shows the maps kept by the tag and the query; `announce` waits this many ms, or stays silent when null. */
  const apply = (delay: number | null): void => {
    const query = input.value.trim();
    const found = search(query);
    let shown = 0;
    for (const { el, id, tags } of strips) {
      el.hidden = !(isShown(tags, tag) && (found === null || found.has(id)));
      if (!el.hidden) shown += 1;
    }
    for (const button of buttons) button.setAttribute('aria-pressed', String((button.dataset['tag'] || null) === tag));
    if (noMatch) noMatch.hidden = shown > 0;
    // Announced after a choice, not on load; while typing, once the typing pauses.
    clearTimeout(announcement);
    if (status) {
      status.textContent = '';
      if (delay !== null) announcement = setTimeout(() => { status.textContent = announce(shown); }, delay);
    }
    const url = new URL(location.href);
    if (tag) url.searchParams.set('tag', tag); else url.searchParams.delete('tag');
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    history.replaceState(history.state, '', url);
  };

  tools.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button[data-tag]');
    if (button) { tag = button.dataset['tag'] || null; apply(0); }
  });
  input.addEventListener('input', () => apply(600));
  // Escape empties the field in every browser, not only those that do it natively.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && input.value) { event.preventDefault(); input.value = ''; apply(0); }
  });
  // "/" jumps to the search, unless it is being typed somewhere.
  document.addEventListener('keydown', (event) => {
    const target = event.target as HTMLElement;
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || target.isContentEditable || target.closest('input, textarea, select')) return;
    event.preventDefault();
    input.focus();
  });
  noMatch?.querySelector('.reset')?.addEventListener('click', () => {
    tag = null;
    input.value = '';
    apply(0);
    input.focus();
  });

  tag = parseTag(location.search, buttons.map((b) => b.dataset['tag'] ?? '').filter(Boolean));
  input.value = parseQuery(location.search);
  if (tag || input.value) apply(null);
  tools.hidden = false;
}
