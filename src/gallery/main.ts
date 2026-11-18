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

// Search: a free query, kept in ?q= so a search can be shared and survives the way back
// from a map. Without this script the field stays hidden and all maps show.

const tools = document.querySelector<HTMLElement>('.tools');
const input = document.querySelector<HTMLInputElement>('#map-search');
if (tools && input) {
  const strips = [...document.querySelectorAll<HTMLElement>('.strip')].map((el) => ({ el, id: el.dataset['id'] ?? '' }));
  const status = tools.querySelector<HTMLElement>('.result-count');
  const noMatch = document.querySelector<HTMLElement>('.no-match');
  const search = createSearch(JSON.parse(document.getElementById('search-index')?.textContent ?? '[]') as SearchDocument[]);
  const lang = document.documentElement.lang;
  const forms = JSON.parse(status?.dataset['forms'] ?? '{}') as Partial<Record<Intl.LDMLPluralRule, string>>;
  const announce = (count: number): string => (forms[new Intl.PluralRules(lang).select(count)] ?? forms.other ?? '')
    .replaceAll('{count}', new Intl.NumberFormat(lang).format(count));

  let announcement: ReturnType<typeof setTimeout> | undefined;

  /** Shows the maps the query keeps; `announce` waits this many ms, or stays silent when null. */
  const apply = (delay: number | null): void => {
    const query = input.value.trim();
    const found = search(query);
    let shown = 0;
    for (const { el, id } of strips) {
      el.hidden = found !== null && !found.has(id);
      if (!el.hidden) shown += 1;
    }
    if (noMatch) noMatch.hidden = shown > 0;
    // Announced after a choice, not on load; while typing, once the typing pauses.
    clearTimeout(announcement);
    if (status) {
      status.textContent = '';
      if (delay !== null) announcement = setTimeout(() => { status.textContent = announce(shown); }, delay);
    }
    const url = new URL(location.href);
    // ?tag= came from the former filters: a shared link still opens on every map.
    url.searchParams.delete('tag');
    if (query) url.searchParams.set('q', query); else url.searchParams.delete('q');
    history.replaceState(history.state, '', url);
  };

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
    input.value = '';
    apply(0);
    input.focus();
  });

  input.value = parseQuery(location.search);
  if (input.value || new URLSearchParams(location.search).has('tag')) apply(null);
  tools.hidden = false;
}
