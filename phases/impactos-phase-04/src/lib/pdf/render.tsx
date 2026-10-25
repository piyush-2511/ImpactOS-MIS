import 'server-only';
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from '@react-pdf/renderer';
import type { ReactElement } from 'react';
import { pdfFont, registerPdfFonts } from './fonts';
import { Letterhead, type LetterheadProps } from './components/Letterhead';

/** Render any @react-pdf document to bytes. Run inside jobs (render-pdf) or route handlers, never in the browser. */
export async function renderPdf(doc: ReactElement): Promise<Uint8Array> {
  registerPdfFonts();
  // renderToBuffer is typed for Document elements; every caller passes one.
  const buf = await renderToBuffer(doc as Parameters<typeof renderToBuffer>[0]);
  return new Uint8Array(buf);
}

const s = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: '#062746' },
  title: { fontSize: 13, fontWeight: 600, marginBottom: 8 },
  row: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#CBD5DF' },
  head: { backgroundColor: '#F1F4F7' },
  cell: { flex: 1, paddingVertical: 4, paddingHorizontal: 3 },
  bold: { fontWeight: 600 },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 32,
    right: 32,
    fontSize: 7.5,
    color: '#44566A',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

/** Table export ("Export → PDF" on list pages): letterhead, title, header row repeated on every page, page numbers. */
export function TableDocument({
  title,
  headers,
  rows,
  locale,
  letterhead,
  generatedAt,
}: {
  title: string;
  headers: string[];
  rows: string[][];
  locale: 'en' | 'hi';
  letterhead: LetterheadProps;
  generatedAt: string;
}) {
  const landscape = headers.length > 6;
  return (
    <Document title={title} author={letterhead.orgName} creator="ImpactOS" language={locale}>
      <Page
        size="A4"
        orientation={landscape ? 'landscape' : 'portrait'}
        style={[s.page, { fontFamily: pdfFont(locale) }]}
      >
        <Letterhead {...letterhead} />
        <Text style={s.title}>{title}</Text>
        <View style={[s.row, s.head]} fixed>
          {headers.map((h) => (
            <Text key={h} style={[s.cell, s.bold]}>
              {h}
            </Text>
          ))}
        </View>
        {rows.map((r, i) => (
          <View key={i} style={s.row} wrap={false}>
            {r.map((c, j) => (
              <Text key={j} style={s.cell}>
                {c}
              </Text>
            ))}
          </View>
        ))}
        <View style={s.footer} fixed>
          <Text>{generatedAt}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
