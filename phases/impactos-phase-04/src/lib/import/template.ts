import writeXlsxFile from 'write-excel-file/node';
import type { ResolvedField } from '@/lib/fields/types';
import { toCsv } from '@/lib/export/csv';

const TYPE_HELP: Record<string, { en: string; hi: string }> = {
  text: { en: 'Text', hi: 'पाठ' },
  number: { en: 'Number, e.g. 1,25,000', hi: 'संख्या, जैसे 1,25,000' },
  date: { en: 'Date, DD/MM/YYYY', hi: 'तारीख, DD/MM/YYYY' },
  boolean: { en: 'Yes or No', hi: 'हाँ या नहीं' },
  email: { en: 'Email address', hi: 'ईमेल पता' },
  phone: { en: '10-digit mobile number', hi: '10 अंकों का मोबाइल नंबर' },
  select: { en: 'One of the allowed values', hi: 'अनुमत मानों में से एक' },
  multiselect: { en: 'Allowed values separated by ;', hi: '; से अलग किए अनुमत मान' },
};
const EXAMPLE: Record<string, string> = {
  text: 'Example',
  number: '10',
  date: '15/08/2026',
  boolean: 'Yes',
  email: 'name@example.org',
  phone: '9876543210',
};

/**
 * "Download sample": the import template for an entity, built from its resolved fields (labels, custom fields,
 * allowed values). Sheet 1 has headers + one example row; sheet 2 explains every column in English and Hindi.
 */
export async function buildTemplate(
  fields: ResolvedField[],
  locale: 'en' | 'hi',
  format: 'xlsx' | 'csv',
): Promise<{ bytes: Uint8Array; mime: string; ext: string }> {
  const cols = fields.filter((f) => f.importable);
  const headers = cols.map((f) => f.label);
  const example = cols.map((f) =>
    f.options[0]
      ? locale === 'hi'
        ? f.options[0].label_hi || f.options[0].label_en
        : f.options[0].label_en
      : (EXAMPLE[f.type] ?? ''),
  );
  if (format === 'csv') {
    return { bytes: new TextEncoder().encode(toCsv(headers, [example])), mime: 'text/csv; charset=utf-8', ext: 'csv' };
  }
  const instr = [
    ['Column / कॉलम', 'Required / ज़रूरी', 'Format / प्रारूप', 'Allowed values / अनुमत मान'],
    ...cols.map((f) => [
      f.label,
      f.required ? 'Yes / हाँ' : 'No / नहीं',
      `${TYPE_HELP[f.type]?.en ?? f.type} / ${TYPE_HELP[f.type]?.hi ?? f.type}`,
      f.options.map((o) => (o.label_hi ? `${o.label_en} (${o.label_hi})` : o.label_en)).join('; '),
    ]),
  ];
  const bold = (v: string) => ({ value: v, fontWeight: 'bold' as const });
  const buffer = await writeXlsxFile([
    { sheet: locale === 'hi' ? 'डेटा' : 'Data', data: [headers.map(bold), example] },
    { sheet: locale === 'hi' ? 'निर्देश' : 'Instructions', data: [instr[0]!.map(bold), ...instr.slice(1)] },
  ]).toBuffer();
  return {
    bytes: new Uint8Array(buffer),
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ext: 'xlsx',
  };
}
