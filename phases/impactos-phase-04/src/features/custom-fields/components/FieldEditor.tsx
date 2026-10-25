'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldOption } from '@/lib/fields/types';
import { valueKeyFrom } from '@/features/option-lists/schema';

/** Options (English + Hindi) and help text of a custom select / multi-select field. Option keys never change once saved. */
export function FieldEditor({
  label,
  options,
  helpEn,
  helpHi,
  onSave,
}: {
  label: string;
  options: FieldOption[];
  helpEn: string;
  helpHi: string;
  onSave: (v: { options: FieldOption[]; helpEn: string; helpHi: string }) => void;
}) {
  const t = useTranslations('engine.fields');
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<FieldOption[]>(options);
  const [hEn, setHEn] = useState(helpEn);
  const [hHi, setHHi] = useState(helpHi);
  const set = (i: number, patch: Partial<FieldOption>) =>
    setOpts((o) => o.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setOpts(options);
          setHEn(helpEn);
          setHHi(helpHi);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {t('optionsN', { n: options.length })}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('optionsTitle', { field: label })}</DialogTitle>
          <DialogDescription>{t('optionsIntro')}</DialogDescription>
        </DialogHeader>
        <div className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
          {opts.map((o, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold">
                {t('optionEn')}
                <Input
                  value={o.label_en}
                  onChange={(e) => set(i, { label_en: e.target.value, key: o.key || valueKeyFrom(e.target.value) })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                {t('optionHi')}
                <Input lang="hi" value={o.label_hi ?? ''} onChange={(e) => set(i, { label_hi: e.target.value })} />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('removeOption', { option: o.label_en || String(i + 1) })}
                onClick={() => setOpts((x) => x.filter((_, j) => j !== i))}
              >
                <Trash2Icon aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="self-start"
            onClick={() => setOpts((o) => [...o, { key: '', label_en: '', label_hi: '' }])}
          >
            <PlusIcon aria-hidden /> {t('addOption')}
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Label className="flex flex-col items-start gap-1">
            {t('helpEn')}
            <Input value={hEn} onChange={(e) => setHEn(e.target.value)} maxLength={200} />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('helpHi')}
            <Input lang="hi" value={hHi} onChange={(e) => setHHi(e.target.value)} maxLength={200} />
          </Label>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={() => {
              const clean = opts
                .filter((o) => o.label_en.trim())
                .map((o) => ({
                  ...o,
                  key: o.key || valueKeyFrom(o.label_en) || `option_${Math.random().toString(36).slice(2, 6)}`,
                }));
              onSave({ options: clean, helpEn: hEn, helpHi: hHi });
              setOpen(false);
            }}
          >
            {t('done')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
