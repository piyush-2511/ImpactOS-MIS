import 'server-only';
import { createElement } from 'react';
import type { ResolvedField } from '@/lib/fields/types';
import { optionLabel } from '@/lib/fields/merge';
import { formatDateNumeric } from '@/lib/i18n/format';
import { renderPdf, TableDocument } from '@/lib/pdf/render';
import { toCsv } from './csv';
import { toXlsx } from './xlsx';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ExportFile = { fileName: string; mime: string; base64: string };
/** PDFs larger than this are rendered by the render-pdf job instead of inline. */
export const INLINE_PDF_ROWS = 500;

/** A cell for export: option keys become labels, booleans Yes/No, dates DD/MM/YYYY for CSV/PDF and real dates for XLSX. */
export function exportCell(
  f: ResolvedField,
  v: unknown,
  locale: 'en' | 'hi',
  format: ExportFormat,
): string | number | boolean | Date | null {
  if (v === null || v === undefined || v === '') return null;
  if (Array.isArray(v)) return v.map((x) => optionLabel(f, String(x), locale)).join('; ');
  switch (f.type) {
    case 'select':
      return optionLabel(f, String(v), locale);
    case 'boolean':
      return v ? (locale === 'hi' ? 'हाँ' : 'Yes') : locale === 'hi' ? 'नहीं' : 'No';
    case 'number':
      return typeof v === 'number' ? v : Number(v);
    case 'date':
      return format === 'xlsx' ? new Date(String(v)) : formatDateNumeric(String(v));
    default:
      return String(v);
  }
}

/** Build an export of the given fields and rows (rows are keyed by field key). */
export async function buildExport(opts: {
  title: string;
  baseName: string;
  fields: ResolvedField[];
  rows: Record<string, unknown>[];
  locale: 'en' | 'hi';
  format: ExportFormat;
  orgName: string;
}): Promise<ExportFile> {
  const headers = opts.fields.map((f) => f.label);
  const matrix = opts.rows.map((r) => opts.fields.map((f) => exportCell(f, r[f.key], opts.locale, opts.format)));
  const stamp = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const name = `${opts.baseName}-${stamp}`;
  if (opts.format === 'csv') {
    return {
      fileName: `${name}.csv`,
      mime: 'text/csv; charset=utf-8',
      base64: Buffer.from(toCsv(headers, matrix), 'utf-8').toString('base64'),
    };
  }
  if (opts.format === 'xlsx') {
    const bytes = await toXlsx(headers, matrix, opts.title);
    return {
      fileName: `${name}.xlsx`,
      mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      base64: Buffer.from(bytes).toString('base64'),
    };
  }
  const bytes = await renderPdf(
    createElement(TableDocument, {
      title: opts.title,
      headers,
      rows: matrix.map((r) => r.map((c) => (c === null ? '' : String(c)))),
      locale: opts.locale,
      letterhead: { orgName: opts.orgName },
      generatedAt: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
    }),
  );
  return { fileName: `${name}.pdf`, mime: 'application/pdf', base64: Buffer.from(bytes).toString('base64') };
}
