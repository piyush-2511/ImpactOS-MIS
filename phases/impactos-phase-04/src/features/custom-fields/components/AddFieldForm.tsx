'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldType } from '@/lib/fields/types';

const TYPES: FieldType[] = ['text', 'number', 'date', 'select', 'multiselect', 'boolean', 'phone', 'email', 'file'];

/** Add a field of any type. Select-type options are entered comma-separated here and edited later in Options. */
export function AddFieldForm({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (f: {
    labelEn: string;
    labelHi: string;
    type: FieldType;
    options: string[];
    showInTable: boolean;
    filterable: boolean;
  }) => void;
}) {
  const t = useTranslations('engine.fields');
  const [labelEn, setLabelEn] = useState('');
  const [labelHi, setLabelHi] = useState('');
  const [type, setType] = useState<FieldType>('text');
  const [opts, setOpts] = useState('');
  const [column, setColumn] = useState(true);
  const [filter, setFilter] = useState(false);
  const needsOptions = type === 'select' || type === 'multiselect';
  return (
    <Card className="flex flex-col gap-3">
      <CardTitle>{t('addTitle')}</CardTitle>
      {disabled && <p className="text-sm text-warn-fg">{t('limitReached')}</p>}
      <form
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!labelEn.trim() || (needsOptions && !opts.trim())) return;
          onAdd({
            labelEn: labelEn.trim(),
            labelHi: labelHi.trim(),
            type,
            options: opts
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
            showInTable: column,
            filterable: filter && type !== 'file',
          });
          setLabelEn('');
          setLabelHi('');
          setOpts('');
          setType('text');
          setFilter(false);
          setColumn(true);
        }}
      >
        <Label className="flex flex-col items-start gap-1">
          {t('labelEn')}
          <Input
            value={labelEn}
            onChange={(e) => setLabelEn(e.target.value)}
            placeholder={t('labelPlaceholder')}
            required
            disabled={disabled}
          />
        </Label>
        <Label className="flex flex-col items-start gap-1">
          {t('labelHi')}
          <Input lang="hi" value={labelHi} onChange={(e) => setLabelHi(e.target.value)} disabled={disabled} />
        </Label>
        <Label className="flex flex-col items-start gap-1">
          {t('colType')}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FieldType)}
            className="min-h-11 w-full rounded-lg border border-input bg-card px-2 font-normal"
            disabled={disabled}
          >
            {TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`types.${ty}`)}
              </option>
            ))}
          </select>
        </Label>
        <Label className="flex flex-col items-start gap-1">
          {t('optionsComma')}
          <Input
            value={opts}
            onChange={(e) => setOpts(e.target.value)}
            placeholder="APL, BPL, AAY"
            disabled={disabled || !needsOptions}
            required={needsOptions}
          />
        </Label>
        <div className="flex items-center gap-2">
          <Checkbox id="af-col" checked={column} onCheckedChange={(v) => setColumn(v === true)} disabled={disabled} />
          <Label htmlFor="af-col" className="font-normal">
            {t('showAsColumn')}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="af-filter"
            checked={filter && type !== 'file'}
            onCheckedChange={(v) => setFilter(v === true)}
            disabled={disabled || type === 'file'}
          />
          <Label htmlFor="af-filter" className="font-normal">
            {t('useAsFilter')}
          </Label>
        </div>
        <Button type="submit" className="self-end sm:col-start-4" disabled={disabled}>
          <PlusIcon aria-hidden /> {t('addField')}
        </Button>
      </form>
    </Card>
  );
}
