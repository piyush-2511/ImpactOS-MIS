import type { FieldOption, ResolvedField } from '@/lib/fields/types';

export type RowError = { row: number; field: string; code: string; value: string };
export type ValidRow = { row: number; values: Record<string, unknown> };
export type ValidationResult = { valid: ValidRow[]; errors: RowError[]; duplicates: number };

const TRUE = new Set(['yes', 'y', 'true', '1', 'हाँ', 'हां', 'ha', 'haan']);
const FALSE = new Set(['no', 'n', 'false', '0', 'नहीं', 'nahi']);

/** Parse Indian-style numbers: "1,25,000.50", "₹ 500". */
export function parseNumber(v: string): number | null {
  const s = v.replace(/[₹,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Number(s);
}

/** dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd, or an Excel serial date → ISO yyyy-mm-dd. */
export function parseDate(v: string): string | null {
  let y: number, m: number, d: number;
  let mt = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (mt) [y, m, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else if ((mt = v.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)))
    [d, m, y] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  else if (/^\d{5}$/.test(v)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000);
    return dt.toISOString().slice(0, 10);
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function matchOption(options: FieldOption[], v: string): string | null {
  const l = v.toLowerCase();
  const o = options.find(
    (x) => x.key.toLowerCase() === l || x.label_en.toLowerCase() === l || (x.label_hi ?? '').toLowerCase() === l,
  );
  return o ? o.key : null;
}

/** Convert one cell to the field's type. Returns [value, errorCode]. Empty → [null, required?]. */
export function coerce(f: ResolvedField, raw: string): [unknown, string | null] {
  const v = raw.trim();
  if (v === '') return [null, f.required ? 'required' : null];
  switch (f.type) {
    case 'number': {
      const n = parseNumber(v);
      return n === null ? [null, 'number'] : [n, null];
    }
    case 'date': {
      const d = parseDate(v);
      return d ? [d, null] : [null, 'date'];
    }
    case 'boolean': {
      const l = v.toLowerCase();
      return TRUE.has(l) ? [true, null] : FALSE.has(l) ? [false, null] : [null, 'boolean'];
    }
    case 'email':
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v) ? [v.toLowerCase(), null] : [null, 'email'];
    case 'phone': {
      const p = v.replace(/[\s-]/g, '').replace(/^0/, '');
      return /^(\+91)?[6-9]\d{9}$/.test(p) ? [p.replace(/^\+91/, ''), null] : [null, 'phone'];
    }
    case 'select': {
      if (!f.options.length) return [v, null];
      const k = matchOption(f.options, v);
      return k ? [k, null] : [null, 'option'];
    }
    case 'multiselect': {
      const parts = v
        .split(/[;,|]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const keys = parts.map((p) => (f.options.length ? matchOption(f.options, p) : p));
      return keys.some((k) => k === null) ? [null, 'option'] : [keys, null];
    }
    case 'file':
      return [null, 'notImportable'];
    default:
      return v.length > 1000 ? [null, 'tooLong'] : [v, null];
  }
}

/**
 * Validate parsed rows against resolved fields and a header→field mapping (pure; also used by tests).
 * Row numbers are spreadsheet row numbers (header is row 1). Rows with a duplicate unique key inside the file are errors.
 */
export function validateRows(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  fields: ResolvedField[],
): ValidationResult {
  const byKey = new Map(fields.map((f) => [f.key, f]));
  const mapped = Object.entries(mapping).filter(([, k]) => byKey.has(k) && byKey.get(k)!.importable);
  const mappedKeys = new Set(mapped.map(([, k]) => k));
  const missingRequired = fields.filter((f) => f.importable && f.required && !mappedKeys.has(f.key));
  const unique = fields.filter((f) => f.unique && mappedKeys.has(f.key));
  const seen = new Map<string, Set<string>>(unique.map((f) => [f.key, new Set()]));
  const valid: ValidRow[] = [];
  const errors: RowError[] = [];
  let duplicates = 0;
  rows.forEach((r, i) => {
    const rowNo = i + 2;
    const values: Record<string, unknown> = {};
    const rowErrors: RowError[] = missingRequired.map((f) => ({
      row: rowNo,
      field: f.key,
      code: 'required',
      value: '',
    }));
    for (const [header, key] of mapped) {
      const [val, err] = coerce(byKey.get(key)!, r[header] ?? '');
      if (err) rowErrors.push({ row: rowNo, field: key, code: err, value: (r[header] ?? '').slice(0, 100) });
      else if (val !== null) values[key] = val;
    }
    for (const f of unique) {
      const k = String(values[f.key] ?? '').toLowerCase();
      if (!k) continue;
      if (seen.get(f.key)!.has(k)) {
        rowErrors.push({ row: rowNo, field: f.key, code: 'duplicateInFile', value: k });
        duplicates++;
      } else seen.get(f.key)!.add(k);
    }
    if (rowErrors.length) errors.push(...rowErrors);
    else valid.push({ row: rowNo, values });
  });
  return { valid, errors, duplicates };
}
