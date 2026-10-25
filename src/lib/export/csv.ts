/**
 * CSV for Excel: UTF-8 with BOM (so Hindi opens correctly), CRLF lines, RFC 4180 quoting, and protection against
 * spreadsheet formula injection (cells starting with = + - @ are prefixed with a quote).
 */
const DANGEROUS = /^[=+\-@\t\r]/;

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = Array.isArray(v) ? v.join('; ') : v instanceof Date ? v.toISOString().slice(0, 10) : String(v);
  if (DANGEROUS.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
