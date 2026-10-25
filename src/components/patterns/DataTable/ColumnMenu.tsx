'use client';

import { useTranslations } from 'next-intl';
import { Columns3Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/** Show or hide columns for this viewer (the organisation's defaults come from Admin → Fields and columns). */
export function ColumnMenu({
  columns,
  hidden,
  onChange,
}: {
  columns: { key: string; label: string; locked?: boolean }[];
  hidden: string[];
  onChange: (hidden: string[]) => void;
}) {
  const t = useTranslations('engine.table');
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3Icon aria-hidden /> {t('columns')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-2">
        <span className="text-sm font-semibold">{t('showColumns')}</span>
        {columns.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <Checkbox
              id={`col-${c.key}`}
              checked={!hidden.includes(c.key)}
              disabled={c.locked}
              onCheckedChange={(v) => onChange(v === true ? hidden.filter((h) => h !== c.key) : [...hidden, c.key])}
            />
            <Label htmlFor={`col-${c.key}`} className="font-normal">
              {c.label}
            </Label>
          </div>
        ))}
        {hidden.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            {t('showAll')}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
