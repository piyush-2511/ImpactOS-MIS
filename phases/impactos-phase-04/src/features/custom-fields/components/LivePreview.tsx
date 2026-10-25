'use client';

import { useTranslations } from 'next-intl';
import { ChevronDownIcon } from 'lucide-react';
import { Card, CardTitle } from '@/components/ui/card';
import { optionLabel } from '@/lib/fields/merge';
import type { ResolvedField } from '@/lib/fields/types';

/** What the page will look like: its filter bar and table columns, filled with a few real rows. */
export function LivePreview({
  fields,
  rows,
  title,
  locale,
}: {
  fields: ResolvedField[];
  rows: Record<string, unknown>[];
  title: string;
  locale: 'en' | 'hi';
}) {
  const t = useTranslations('engine.fields');
  const cols = fields.filter((f) => f.showInTable);
  const filters = fields.filter((f) => f.filterable);
  const cell = (f: ResolvedField, v: unknown) => {
    if (v === null || v === undefined || v === '') return '—';
    if (Array.isArray(v)) return v.map((x) => optionLabel(f, String(x), locale)).join(', ');
    if (f.type === 'boolean') return v ? t('yes') : t('no');
    if (f.type === 'select') return optionLabel(f, String(v), locale);
    return String(v);
  };
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('previewTitle', { page: title })}</CardTitle>
        <span className="text-sm text-muted-foreground">
          {t('previewCounts', { columns: cols.length, filters: filters.length })}
        </span>
      </div>
      <div className="flex flex-wrap gap-2" aria-label={t('previewFilters')}>
        {filters.length === 0 && <span className="text-sm text-muted-foreground">{t('noFilters')}</span>}
        {filters.map((f) => (
          <span
            key={f.key}
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border px-3 text-sm"
          >
            {f.label}: {t('any')} <ChevronDownIcon className="size-3.5" aria-hidden />
          </span>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[12.5px] text-muted-foreground">
              {cols.map((f) => (
                <th key={f.key} className="whitespace-nowrap px-3 py-2 font-semibold">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={cols.length} className="px-3 py-4 text-muted-foreground">
                  {t('noRows')}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border/60">
                {cols.map((f) => (
                  <td key={f.key} className="px-3 py-2">
                    {cell(f, r[f.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
