'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
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
import { LOCALE_LABELS } from '@/lib/i18n/config';
import { createTenantAction } from '../actions';

/** Sales-led onboarding: create the organisation; its Secretary gets a 14-day invitation. */
export function CreateTenantDialog() {
  const t = useTranslations('console.tenants');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>{t('create')}</Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('createTitle')}</DialogTitle>
          <DialogDescription>{t('createIntro')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            start(async () => {
              const r = await createTenantAction({
                name: fd.get('name'),
                slug: fd.get('slug'),
                legalForm: fd.get('legalForm'),
                state: fd.get('state'),
                secretaryEmail: fd.get('email'),
                planKey: fd.get('plan'),
                locale: fd.get('locale'),
              });
              if (!r.ok) return void toast.error(t(r.error === 'slugTaken' ? 'slugTaken' : 'failed'));
              toast.success(t('created'));
              setOpen(false);
              router.push(`/console/tenants/${r.data.id}`);
            })
          }
        >
          <Label className="flex flex-col items-start gap-1 sm:col-span-2">
            {t('name')}
            <Input name="name" required />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('slug')}
            <Input name="slug" required className="font-mono" />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('legalForm')}
            <select
              name="legalForm"
              className="min-h-11 w-full rounded-lg border border-input bg-card px-2 font-normal"
            >
              {['trust', 'society', 'section8', 'other'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('state')}
            <Input name="state" required defaultValue="Bihar" />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('plan')}
            <select
              name="plan"
              defaultValue="growth"
              className="min-h-11 w-full rounded-lg border border-input bg-card px-2 font-normal"
            >
              {['starter', 'growth', 'enterprise'].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('secretaryEmail')}
            <Input name="email" type="email" required />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('language')}
            <select name="locale" className="min-h-11 w-full rounded-lg border border-input bg-card px-2 font-normal">
              <option value="en">{LOCALE_LABELS.en}</option>
              <option value="hi">{LOCALE_LABELS.hi}</option>
            </select>
          </Label>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {t('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
