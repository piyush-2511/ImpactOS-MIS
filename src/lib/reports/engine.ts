import { z } from 'zod';
import type { ResolvedField } from '@/lib/fields/types';

/** Saved report config (report_definitions.config). Used by every module's Reports page and the Report Builder. */
export const reportConfigSchema = z.object({
  entity: z.string().regex(/^[a-z][a-z_]{1,40}$/),
  groupBy: z.string().regex(/^[a-z][a-z0-9_]{0,60}$/),
  metric: z.discriminatedUnion('type', [
    z.object({ type: z.literal('count') }),
    z.object({ type: z.literal('sum'), field: z.string().regex(/^[a-z][a-z0-9_]{0,60}$/) }),
  ]),
  filters: z.record(z.string(), z.array(z.string()).max(50)).default({}),
  chart: z.enum(['bar', 'line', 'table']).default('bar'),
  limit: z.number().int().min(1).max(50).default(20),
});
export type ReportConfig = z.infer<typeof reportConfigSchema>;
export type ReportRow = { key: string; label: string; value: number };
export type ReportResult = { rows: ReportRow[]; total: number; truncated: boolean };

export const MAX_REPORT_SOURCE_ROWS = 20_000;

const read = (row: Record<string, unknown>, f: ResolvedField): unknown =>
  f.builtin ? row[f.column ?? f.key] : (row.custom_fields as Record<string, unknown> | null)?.[f.key];

/**
 * Group and aggregate rows (pure). Multiselect values count once per selected option; empty values group as "".
 * Results are sorted by value (dates by key) and cut to `limit`, with the remainder summed as "other".
 */
export function aggregate(
  rows: Record<string, unknown>[],
  config: ReportConfig,
  fields: ResolvedField[],
  labelOf: (f: ResolvedField, v: string) => string,
): ReportResult {
  const g = fields.find((f) => f.key === config.groupBy);
  if (!g) throw new Error('unknown group field');
  const m =
    config.metric.type === 'sum'
      ? fields.find((f) => f.key === (config.metric as { field: string }).field && f.type === 'number')
      : null;
  if (config.metric.type === 'sum' && !m) throw new Error('sum needs a number field');
  const totals = new Map<string, number>();
  let total = 0;
  for (const row of rows) {
    const raw = read(row, g);
    const keys = Array.isArray(raw)
      ? raw.map(String)
      : [raw === null || raw === undefined ? '' : g.type === 'date' ? String(raw).slice(0, 7) : String(raw)];
    const amount = m ? Number(read(row, m) ?? 0) || 0 : 1;
    for (const k of keys) totals.set(k, (totals.get(k) ?? 0) + amount);
    total += amount;
  }
  let out = [...totals.entries()].map(([key, value]) => ({ key, label: key === '' ? '—' : labelOf(g, key), value }));
  out = g.type === 'date' ? out.sort((a, b) => a.key.localeCompare(b.key)) : out.sort((a, b) => b.value - a.value);
  const truncated = out.length > config.limit;
  if (truncated && g.type !== 'date') {
    const rest = out.slice(config.limit - 1).reduce((s, r) => s + r.value, 0);
    out = [...out.slice(0, config.limit - 1), { key: '__other', label: 'Other', value: rest }];
  }
  return { rows: out, total, truncated };
}
