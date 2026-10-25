'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RowError } from '@/lib/import/validate';

/** Step 3: what will happen. Valid rows will be added; rows with problems are listed with the column and the fix. */
export function ValidatePreview({
  total,
  valid,
  errorRows,
  errors,
  fieldLabels,
}: {
  total: number;
  valid: number;
  errorRows: number;
  errors: RowError[];
  fieldLabels: Record<string, string>;
}) {
  const t = useTranslations('engine.import');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">{t('rowsInFile', { n: total })}</Badge>
        <Badge tone="ok">{t('rowsReady', { n: valid })}</Badge>
        {errorRows > 0 && <Badge tone="bad">{t('rowsWithProblems', { n: errorRows })}</Badge>}
      </div>
      {errors.length > 0 && (
        <div className="max-h-[40vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('row')}</TableHead>
                <TableHead>{t('column')}</TableHead>
                <TableHead>{t('problem')}</TableHead>
                <TableHead>{t('value')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {errors.map((e, i) => (
                <TableRow key={`${e.row}-${e.field}-${i}`}>
                  <TableCell className="font-mono">{e.row}</TableCell>
                  <TableCell>{fieldLabels[e.field] ?? e.field}</TableCell>
                  <TableCell>{t(`codes.${e.code}`)}</TableCell>
                  <TableCell className="max-w-40 truncate font-mono text-xs">{e.value || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
