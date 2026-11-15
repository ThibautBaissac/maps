// Loads a font file from public/fonts/ and registers it for canvas and CSS use.
// Example: await loadFont('IM Fell English', 'IMFellEnglish-Regular.ttf');
export async function loadFont(family: string, file: string, descriptors: FontFaceDescriptors = {}): Promise<FontFace> {
  const face = new FontFace(family, `url(${import.meta.env.BASE_URL}fonts/${file})`, descriptors);
  document.fonts.add(await face.load());
  return face;
}
