// Required element of the page, checked for its type.
export function element<T extends Element>(selector: string, type: abstract new () => T): T {
  const el = document.querySelector(selector);
  if (!(el instanceof type)) throw new Error(`Missing ${type.name} "${selector}" in the page`);
  return el;
}

// Required data-* attribute of <body>.
export function bodyData(key: string): string {
  const v = document.body.dataset[key];
  if (v === undefined) throw new Error(`Missing data-${key} on <body>`);
  return v;
}
