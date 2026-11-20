// Entry of the French map pages: their dictionary, then the page, opened only once
// every import has run (a bundle does not keep the order of side-effect imports).
import '../i18n/fr.ts';
import { openMapPage } from '../map-page.ts';

await openMapPage();
