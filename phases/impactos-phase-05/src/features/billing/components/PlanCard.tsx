'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { formatPaise, trialDaysLeft, type PlanInfo } from '@/lib/billing/plans';
import { cn } from '@/lib/utils';
import { choosePlanAction } from '../actions';
import type { PlanOption } from '../queries';

const STATUS_TONE = { trialing: 'info', active: 'ok', past_due: 'warn', read_only: 'bad', cancelled: 'bad' } as const;

/** Current plan, status, and choosing or changing plan (monthly or yearly with two months free). */
export function PlanCard({
  plan,
  options,
  locale,
  canManage,
}: {
  plan: PlanInfo;
  options: PlanOption[];
  locale: 'en' | 'hi';
  canManage: boolean;
}) {
  const t = useTranslations('billing.plan');
  const router = useRouter();
  const [period, setPeriod] = useState<'monthly' | 'annual'>(plan.period);
  const [pending, start] = useTransition();
  const days = trialDaysLeft(plan.trialEndsAt);
  const choose = (key: string) =>
    start(async () => {
      const r = await choosePlanAction({ planKey: key, period });
      if (!r.ok) {
        const over = r.fieldErrors
          ? Object.keys(r.fieldErrors)
              .map((k) => t(`limitNames.${k}`))
              .join(', ')
          : '';
        return void toast.error(r.error === 'downgradeBlocked' ? t('downgradeBlocked', { limits: over }) : t('failed'));
      }
      toast.success(t(`applied.${r.data.applied}`));
      router.refresh();
    });
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{t('title')}</CardTitle>
        <Badge tone={STATUS_TONE[plan.status]}>{t(`status.${plan.status}`)}</Badge>
      </div>
      <p className="text-sm">
        {plan.status === 'trialing'
          ? t('trialing', { plan: plan.planName, days })
          : t('current', {
              plan: plan.planName,
              price: formatPaise(plan.period === 'annual' ? plan.annualPaise : plan.monthlyPaise, locale),
              period: t(`per.${plan.period}`),
            })}
      </p>
      {plan.pendingPlanKey && (
        <p className="rounded-lg bg-info-bg px-3 py-2 text-sm text-info-fg">
          {t('pending', { plan: options.find((o) => o.key === plan.pendingPlanKey)?.name ?? plan.pendingPlanKey })}
        </p>
      )}
      {canManage && (
        <>
          <div
            role="radiogroup"
            aria-label={t('periodLabel')}
            className="flex w-fit overflow-hidden rounded-lg border border-border"
          >
            {(['monthly', 'annual'] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={period === p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'min-h-10 px-4 text-sm',
                  period === p ? 'bg-primary font-semibold text-primary-foreground' : 'bg-card',
                )}
              >
                {t(`periods.${p}`)}
              </button>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {options.map((o) => {
              const isCurrent = o.key === plan.planKey && period === plan.period;
              return (
                <div
                  key={o.key}
                  className={cn(
                    'flex flex-col gap-2 rounded-xl border border-border p-4',
                    isCurrent && 'ring-2 ring-green',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{o.name}</span>
                    {isCurrent && <Badge tone="ok">{t('yourPlan')}</Badge>}
                  </div>
                  <span className="font-mono text-xl font-bold">
                    {formatPaise(period === 'annual' ? o.annualPaise : o.monthlyPaise, locale)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t(`per.${period}`)} · {t('gstExtra')}
                  </span>
                  <ul className="flex flex-col gap-0.5 text-sm">
                    <li>{t('seats', { n: o.limits.staff_seats ?? '∞' })}</li>
                    <li>{t('storage', { n: o.limits.storage_gb ?? '∞' })}</li>
                    <li>{t('modules', { n: o.modules.length })}</li>
                  </ul>
                  <Button
                    size="sm"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={pending || isCurrent}
                    onClick={() => choose(o.key)}
                    className="mt-auto"
                  >
                    {isCurrent ? t('selected') : plan.status === 'trialing' ? t('choose') : t('switch')}
                  </Button>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('rules')}</p>
        </>
      )}
    </Card>
  );
}
