import { describe, expect, it } from 'vitest';
import { mergeFields } from '@/lib/fields/merge';
import { ENTITIES } from '@/lib/fields/registry';
import { coerce, parseDate, parseNumber, validateRows } from '@/lib/import/validate';
import { parseFile, ParseError, suggestMapping } from '@/lib/import/parse';
import { csvCell, toCsv } from '@/lib/export/csv';

const fields = mergeFields(ENTITIES.lookup_values!, [], [], 'en');
const f = (k: string) => fields.find((x) => x.key === k)!;

describe('value parsing', () => {
  it('reads Indian numbers', () => {
    expect(parseNumber('1,25,000.50')).toBe(125000.5);
    expect(parseNumber('₹ 500')).toBe(500);
    expect(parseNumber('12a')).toBeNull();
  });
  it('reads Indian and ISO dates, rejects impossible ones', () => {
    expect(parseDate('15/08/2026')).toBe('2026-08-15');
    expect(parseDate('2026-08-15')).toBe('2026-08-15');
    expect(parseDate('31/02/2026')).toBeNull();
    expect(parseDate('46249')).toBe('2026-08-15');
  });
  it('accepts yes/no in English and Hindi', () => {
    expect(coerce(f('active'), 'हाँ')).toEqual([true, null]);
    expect(coerce(f('active'), 'No')).toEqual([false, null]);
    expect(coerce(f('active'), 'maybe')).toEqual([null, 'boolean']);
  });
});

describe('validateRows', () => {
  const mapping = { Key: 'value_key', 'Label (English)': 'label_en', Order: 'sort_order', Active: 'active' };
  it('separates valid rows from errors with spreadsheet row numbers', () => {
    const res = validateRows(
      [
        { Key: 'health', 'Label (English)': 'Health', Order: '1', Active: 'yes' },
        { Key: 'edu', 'Label (English)': '', Order: 'two', Active: 'yes' },
      ],
      mapping,
      fields,
    );
    expect(res.valid).toHaveLength(1);
    expect(res.valid[0]!.values).toEqual({ value_key: 'health', label_en: 'Health', sort_order: 1, active: true });
    expect(res.errors.map((e) => [e.row, e.field, e.code])).toEqual([
      [3, 'label_en', 'required'],
      [3, 'sort_order', 'number'],
    ]);
  });
  it('flags duplicate keys inside the file', () => {
    const res = validateRows(
      [
        { Key: 'a', 'Label (English)': 'A' },
        { Key: 'A', 'Label (English)': 'A2' },
      ],
      mapping,
      fields,
    );
    expect(res.duplicates).toBe(1);
    expect(res.errors[0]!.code).toBe('duplicateInFile');
  });
  it('reports a required field that is not mapped on every row', () => {
    const res = validateRows([{ Key: 'a' }], { Key: 'value_key' }, fields);
    expect(res.errors.some((e) => e.field === 'label_en' && e.code === 'required')).toBe(true);
  });
});

describe('file parsing and mapping', () => {
  it('parses CSV with BOM and Hindi text', async () => {
    const csv = '\uFEFFKey,Label (English),Label (Hindi)\r\nhealth,Health,स्वास्थ्य\r\n';
    const res = await parseFile('list.csv', new TextEncoder().encode(csv));
    expect(res.headers).toEqual(['Key', 'Label (English)', 'Label (Hindi)']);
    expect(res.rows[0]!['Label (Hindi)']).toBe('स्वास्थ्य');
  });
  it('refuses duplicate headings and unknown file types', async () => {
    await expect(parseFile('a.csv', new TextEncoder().encode('A,a\n1,2'))).rejects.toBeInstanceOf(ParseError);
    await expect(parseFile('a.pdf', new Uint8Array([1]))).rejects.toThrow('unsupported');
  });
  it('suggests a mapping from English or Hindi labels', () => {
    expect(suggestMapping(['label (english)', 'नाम (हिंदी)', 'Other'], fields)).toEqual({
      'label (english)': 'label_en',
      'नाम (हिंदी)': 'label_hi',
    });
  });
});

describe('CSV export', () => {
  it('protects against spreadsheet formula injection but keeps negative numbers', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-1200')).toBe('-1200');
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });
  it('starts with a BOM so Excel opens Hindi correctly', () => {
    expect(toCsv(['a'], [['ब']]).startsWith('\uFEFF')).toBe(true);
  });
});

describe('templates and PDFs (real files)', () => {
  it('the Excel sample opens back with the same headings and an example row', async () => {
    const { buildTemplate } = await import('@/lib/import/template');
    const xlsx = await buildTemplate(fields, 'en', 'xlsx');
    const parsed = await parseFile('sample.xlsx', xlsx.bytes);
    expect(parsed.headers).toEqual(fields.filter((x) => x.importable).map((x) => x.label));
    expect(parsed.rows).toHaveLength(1);
  });
  it('renders a bilingual PDF table with the embedded fonts', async () => {
    const { renderPdf, TableDocument } = await import('@/lib/pdf/render');
    const { createElement } = await import('react');
    const bytes = await renderPdf(
      createElement(TableDocument, {
        title: 'विभाग',
        headers: ['Key', 'नाम'],
        rows: [['health', 'स्वास्थ्य']],
        locale: 'hi',
        letterhead: { orgName: 'अंबेडकर फाउंडेशन' },
        generatedAt: '20/10/2026',
      }),
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect(bytes.byteLength).toBeGreaterThan(5000);
  }, 30_000);
});
