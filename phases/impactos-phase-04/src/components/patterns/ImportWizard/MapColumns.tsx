'use client';

import { useTranslations } from 'next-intl';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type ImportField = { key: string; label: string; required: boolean; type: string };

/** Step 2: match each spreadsheet column to a field (suggested from labels in English or Hindi). */
export function MapColumns({
  headers,
  sample,
  fields,
  mapping,
  onChange,
}: {
  headers: string[];
  sample: Record<string, string>[];
  fields: ImportField[];
  mapping: Record<string, string>;
  onChange: (m: Record<string, string>) => void;
}) {
  const t = useTranslations('engine.import');
  const used = new Set(Object.values(mapping));
  const missing = fields.filter((f) => f.required && !used.has(f.key));
  return (
    <div className="flex flex-col gap-3">
      {missing.length > 0 && (
        <p role="alert" className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">
          {t('missingRequired', { fields: missing.map((f) => f.label).join(', ') })}
        </p>
      )}
      <div className="max-h-[50vh] overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fileColumn')}</TableHead>
              <TableHead>{t('example')}</TableHead>
              <TableHead>{t('saveAs')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {headers.map((h) => (
              <TableRow key={h}>
                <TableCell className="font-semibold">{h}</TableCell>
                <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                  {sample.find((r) => r[h])?.[h] ?? '—'}
                </TableCell>
                <TableCell>
                  <label className="sr-only" htmlFor={`map-${h}`}>
                    {t('saveAsFor', { column: h })}
                  </label>
                  <select
                    id={`map-${h}`}
                    value={mapping[h] ?? ''}
                    onChange={(e) => onChange({ ...mapping, [h]: e.target.value })}
                    className="min-h-10 w-full rounded-lg border border-input bg-card px-2"
                  >
                    <option value="">{t('skip')}</option>
                    {fields.map((f) => (
                      <option key={f.key} value={f.key} disabled={used.has(f.key) && mapping[h] !== f.key}>
                        {f.label}
                        {f.required ? ' *' : ''}
                      </option>
                    ))}
                  </select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
