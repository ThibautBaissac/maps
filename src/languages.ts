// The language menu is a <details>: it opens and closes without JavaScript. This adds
// what a menu is expected to do: Escape closes it and returns focus to its button, and a
// click or focus outside closes it.
export function enhanceLanguageMenu(): void {
  const menu = document.querySelector<HTMLDetailsElement>('.languages details');
  const summary = menu?.querySelector('summary');
  if (!menu || !summary) return;
  menu.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu.open) return;
    menu.open = false;
    summary.focus();
    event.stopPropagation();
  });
  const closeOutside = (event: Event): void => {
    if (menu.open && event.target instanceof Node && !menu.contains(event.target)) menu.open = false;
  };
  document.addEventListener('click', closeOutside);
  document.addEventListener('focusin', closeOutside);
}
