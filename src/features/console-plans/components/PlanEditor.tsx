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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LIMIT_KEYS, PLAN_MODULES } from '@/lib/billing/plans';
import { savePlanAction } from '../actions';
import type { PlanRow } from '../queries';

export function PlanEditor({ plan }: { plan: PlanRow }) {
  const t = useTranslations('console.plans');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mods, setMods] = useState<string[]>(plan.modules);
  const [flags, setFlags] = useState({ isPublic: plan.isPublic, active: plan.active });
  const [pending, start] = useTransition();
  const r = (p: number) => p / 100;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t('edit')}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(720px,calc(100%-2rem))]" closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('editTitle', { plan: plan.name })}</DialogTitle>
          <DialogDescription>{t('editIntro')}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          action={(fd) =>
            start(async () => {
              const res = await savePlanAction({
                key: plan.key,
                name: fd.get('name'),
                description: fd.get('description'),
                monthlyRupees: fd.get('monthly'),
                annualRupees: fd.get('annual'),
                extraSeatRupees: fd.get('extraSeat'),
                donationFeePercent: fd.get('fee'),
                donationFeeCapRupees: fd.get('feeCap'),
                ...flags,
                modules: mods,
                limits: Object.fromEntries(LIMIT_KEYS.map((k) => [k, fd.get(`limit_${k}`) ?? ''])),
              });
              if (!res.ok) return void toast.error(t('failed'));
              toast.success(t('saved'));
              setOpen(false);
              router.refresh();
            })
          }
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Label className="flex flex-col items-start gap-1">
              {t('name')}
              <Input name="name" defaultValue={plan.name} required />
            </Label>
            <Label className="flex flex-col items-start gap-1 sm:col-span-2">
              {t('description')}
              <Input name="description" defaultValue={plan.description ?? ''} />
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t('monthly')}
              <Input name="monthly" type="number" step="1" defaultValue={r(plan.monthlyPaise)} />
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t('annual')}
              <Input name="annual" type="number" step="1" defaultValue={r(plan.annualPaise)} />
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t('extraSeat')}
              <Input name="extraSeat" type="number" step="1" defaultValue={r(plan.extraSeatPaise)} />
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t('fee')}
              <Input name="fee" type="number" step="0.1" defaultValue={plan.donationFeeBps / 100} />
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t('feeCap')}
              <Input name="feeCap" type="number" step="1" defaultValue={r(plan.donationFeeCapPaise)} />
            </Label>
          </div>
          <fieldset className="grid gap-3 sm:grid-cols-5">
            <legend className="mb-1 text-sm font-semibold">{t('limits')}</legend>
            {LIMIT_KEYS.map((k) => (
              <Label key={k} className="flex flex-col items-start gap-1 text-xs">
                {t(`limitNames.${k}`)}
                <Input
                  name={`limit_${k}`}
                  type="number"
                  min={0}
                  defaultValue={plan.limits[k] ?? ''}
                  placeholder={t('unlimited')}
                />
              </Label>
            ))}
          </fieldset>
          <fieldset className="flex flex-wrap gap-3">
            <legend className="mb-1 text-sm font-semibold">{t('modules')}</legend>
            {PLAN_MODULES.map((m) => (
              <span key={m} className="flex items-center gap-1.5">
                <Checkbox
                  id={`pm-${m}`}
                  checked={mods.includes(m)}
                  onCheckedChange={(v) => setMods((s) => (v === true ? [...s, m] : s.filter((x) => x !== m)))}
                />
                <Label htmlFor={`pm-${m}`} className="font-normal">
                  {m}
                </Label>
              </span>
            ))}
          </fieldset>
          <div className="flex flex-wrap gap-4">
            <span className="flex items-center gap-1.5">
              <Checkbox
                id="pl-public"
                checked={flags.isPublic}
                onCheckedChange={(v) => setFlags((f) => ({ ...f, isPublic: v === true }))}
              />
              <Label htmlFor="pl-public" className="font-normal">
                {t('public')}
              </Label>
            </span>
            <span className="flex items-center gap-1.5">
              <Checkbox
                id="pl-active"
                checked={flags.active}
                onCheckedChange={(v) => setFlags((f) => ({ ...f, active: v === true }))}
              />
              <Label htmlFor="pl-active" className="font-normal">
                {t('active')}
              </Label>
            </span>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
