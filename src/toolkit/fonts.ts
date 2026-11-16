// Loads a font file from public/fonts/ and registers it for canvas and CSS use.
// Example: await loadFont('IM Fell English', 'IMFellEnglish-Regular.ttf');
// import.meta.env only exists under Vite: tests mount styles under plain Node.
export async function loadFont(family: string, file: string, descriptors: FontFaceDescriptors = {}): Promise<FontFace> {
  const base = import.meta.env?.BASE_URL ?? '/';
  const face = new FontFace(family, `url(${base}fonts/${file})`, descriptors);
  document.fonts.add(await face.load());
  return face;
}
