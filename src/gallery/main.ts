// The gallery content is rendered in its language at build time. A missing picture
// leaves the style's paper and dot pattern visible, as it did before localization.
for (const img of document.querySelectorAll<HTMLImageElement>('.strip img')) {
  const remove = (): void => img.remove();
  img.addEventListener('error', remove);
  if (img.complete && !img.naturalWidth) remove();
}
