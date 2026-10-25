'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveValueAction } from '../actions';
import type { ValueRow } from '../queries';
import { valueKeyFrom } from '../schema';

/** Add or edit one value of an option list (English and Hindi labels, order, colour, in use). */
export function OptionListEditor({
  listKey,
  value,
  open,
  onOpenChange,
}: {
  listKey: string;
  value: ValueRow | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('engine.lists');
  const router = useRouter();
  const [labelEn, setLabelEn] = useState(value?.label_en ?? '');
  const [active, setActive] = useState(value?.active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  const key = value?.value_key ?? valueKeyFrom(labelEn);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{value ? t('editTitle') : t('addTitle')}</DialogTitle>
          <DialogDescription>{value?.is_default ? t('defaultNote') : t('formIntro')}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          noValidate
          action={(fd) =>
            start(async () => {
              const r = await saveValueAction({
                listKey,
                valueKey: key,
                labelEn: fd.get('labelEn'),
                labelHi: fd.get('labelHi'),
                color: fd.get('color') || '',
                sortOrder: fd.get('sortOrder'),
                active,
              });
              if (!r.ok) return void setErrors(r.fieldErrors ?? { form: r.error });
              toast.success(t('saved'));
              onOpenChange(false);
              router.refresh();
            })
          }
        >
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${errors.form}`)}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ol-en">{t('labelEn')}</Label>
              <Input
                id="ol-en"
                name="labelEn"
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                required
                aria-invalid={!!errors.labelEn}
              />
              {errors.labelEn && (
                <p role="alert" className="text-sm text-destructive">
                  {t(`errors.${errors.labelEn}`)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ol-hi">{t('labelHi')}</Label>
              <Input id="ol-hi" name="labelHi" lang="hi" defaultValue={value?.label_hi ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ol-key">{t('key')}</Label>
              <Input
                id="ol-key"
                value={key}
                readOnly
                className="font-mono"
                aria-describedby="ol-key-hint"
                aria-invalid={!!errors.valueKey}
              />
              <p id="ol-key-hint" className="text-xs text-muted-foreground">
                {t('keyHint')}
              </p>
              {errors.valueKey && (
                <p role="alert" className="text-sm text-destructive">
                  {t(`errors.${errors.valueKey}`)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ol-order">{t('order')}</Label>
              <Input id="ol-order" name="sortOrder" type="number" min={0} defaultValue={value?.sort_order ?? 0} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ol-color">{t('color')}</Label>
              <Input
                id="ol-color"
                name="color"
                type="color"
                defaultValue={value?.color ?? '#0B4F8A'}
                className="h-11 w-20 p-1"
              />
            </div>
            <div className="flex items-center gap-2 self-end pb-2">
              <Checkbox id="ol-active" checked={active} onCheckedChange={(v) => setActive(v === true)} />
              <Label htmlFor="ol-active" className="font-normal">
                {t('inUse')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || !key}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
