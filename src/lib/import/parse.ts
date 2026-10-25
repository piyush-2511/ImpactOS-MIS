import Papa from 'papaparse';
import { readSheet } from 'read-excel-file/node';

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 20_000;
export type ParsedFile = { headers: string[]; rows: Record<string, string>[] };

export class ParseError extends Error {
  constructor(public code: 'tooLarge' | 'tooManyRows' | 'unsupported' | 'empty' | 'unreadable' | 'duplicateHeaders') {
    super(code);
  }
}

const clean = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v)
    .replace(/\u00a0/g, ' ')
    .trim();
};

function toRecords(matrix: unknown[][]): ParsedFile {
  const nonEmpty = matrix.filter((r) => r.some((c) => clean(c) !== ''));
  if (nonEmpty.length < 1) throw new ParseError('empty');
  const headers = nonEmpty[0]!.map(clean);
  if (headers.every((h) => !h)) throw new ParseError('empty');
  const seen = new Set<string>();
  for (const h of headers.filter(Boolean)) {
    const k = h.toLowerCase();
    if (seen.has(k)) throw new ParseError('duplicateHeaders');
    seen.add(k);
  }
  const body = nonEmpty.slice(1);
  if (body.length > MAX_IMPORT_ROWS) throw new ParseError('tooManyRows');
  const rows = body.map((r) => Object.fromEntries(headers.map((h, i) => [h, clean(r[i])]).filter(([h]) => h)));
  return { headers: headers.filter(Boolean), rows };
}

/** Parse an uploaded CSV or XLSX (first sheet) into header-keyed string rows. Server-side only. */
export async function parseFile(name: string, bytes: Uint8Array): Promise<ParsedFile> {
  if (bytes.byteLength > MAX_IMPORT_BYTES) throw new ParseError('tooLarge');
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) {
    const text = new TextDecoder('utf-8').decode(bytes).replace(/^\uFEFF/, '');
    const res = Papa.parse<string[]>(text, { skipEmptyLines: 'greedy' });
    if (res.errors.some((e) => e.type === 'Delimiter')) throw new ParseError('unreadable');
    return toRecords(res.data);
  }
  if (lower.endsWith('.xlsx')) {
    try {
      const data = await readSheet(Buffer.from(bytes));
      return toRecords(data as unknown[][]);
    } catch (e) {
      if (e instanceof ParseError) throw e;
      throw new ParseError('unreadable');
    }
  }
  throw new ParseError('unsupported');
}

/** Suggest a column → field mapping by matching headers to English/Hindi labels and keys (case/spacing-insensitive). */
export function suggestMapping(
  headers: string[],
  fields: { key: string; labels: { en: string; hi: string } }[],
): Record<string, string> {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u0900-\u097f]+/g, '');
  const out: Record<string, string> = {};
  const used = new Set<string>();
  for (const h of headers) {
    const n = norm(h);
    const f = fields.find((x) => !used.has(x.key) && [x.key, x.labels.en, x.labels.hi].some((c) => norm(c) === n));
    if (f) {
      out[h] = f.key;
      used.add(f.key);
    }
  }
  return out;
}
