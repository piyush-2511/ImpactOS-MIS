import 'server-only';
import { join } from 'node:path';
import { Font } from '@react-pdf/renderer';

/**
 * Embedded IBM Plex Sans (Latin) and IBM Plex Sans Devanagari (Hindi), SIL OFL (see fonts/OFL.txt). Registered once
 * per process. Files are included in serverless bundles via outputFileTracingIncludes in next.config.ts.
 */
let done = false;
const dir = () => join(process.cwd(), 'src', 'lib', 'pdf', 'fonts');

export function registerPdfFonts() {
  if (done) return;
  Font.register({
    family: 'Plex',
    fonts: [
      { src: join(dir(), 'IBMPlexSans-Regular.ttf'), fontWeight: 400 },
      { src: join(dir(), 'IBMPlexSans-SemiBold.ttf'), fontWeight: 600 },
    ],
  });
  Font.register({
    family: 'PlexDeva',
    fonts: [
      { src: join(dir(), 'IBMPlexSansDevanagari-Regular.ttf'), fontWeight: 400 },
      { src: join(dir(), 'IBMPlexSansDevanagari-SemiBold.ttf'), fontWeight: 600 },
    ],
  });
  // Never split words with hyphens (names, Hindi text).
  Font.registerHyphenationCallback((word) => [word]);
  done = true;
}

/** Hindi documents use the Devanagari face (it also contains Latin letters and digits). */
export const pdfFont = (locale: 'en' | 'hi') => (locale === 'hi' ? 'PlexDeva' : 'Plex');
