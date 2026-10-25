'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { grantSupportAction, revokeSupportAction } from '../actions';
import type { GrantRow } from '../queries';

/** Give or end ImpactOS support access. Access is read-only, time-limited and every view is logged. */
export function SupportAccessCard({
  grants,
  when,
  canManage,
}: {
  grants: GrantRow[];
  when: Record<string, string>;
  canManage: boolean;
}) {
  const t = useTranslations('billing.support');
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = grants.filter((g) => g.active);
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>{t('title')}</CardTitle>
      <p className="text-sm text-muted-foreground">{t('intro')}</p>
      {active.map((g) => (
        <div
          key={g.id}
          className="flex flex-wrap items-center gap-3 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-fg"
        >
          <Badge tone={g.breakGlass ? 'warn' : 'info'}>{g.breakGlass ? t('breakGlass') : t('active')}</Badge>
          <span className="flex-1">
            {t('until', { when: when[g.id] ?? '' })} · {g.reason}
          </span>
          {canManage && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await revokeSupportAction({ grantId: g.id });
                  if (r.ok) {
                    toast.success(t('revoked'));
                    router.refresh();
                  }
                })
              }
            >
              {t('end')}
            </Button>
          )}
        </div>
      ))}
      {canManage && active.length === 0 && (
        <form
          className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end"
          action={(fd) =>
            start(async () => {
              const r = await grantSupportAction({ hours: fd.get('hours'), reason: fd.get('reason') });
              if (!r.ok)
                return void toast.error(t(`errors.${r.fieldErrors ? Object.values(r.fieldErrors)[0] : r.error}`));
              toast.success(t('granted'));
              router.refresh();
            })
          }
        >
          <Label className="flex flex-col items-start gap-1">
            {t('duration')}
            <select
              name="hours"
              defaultValue="24"
              className="min-h-11 rounded-lg border border-input bg-card px-2 font-normal"
            >
              {[4, 24, 72].map((h) => (
                <option key={h} value={h}>
                  {t('hours', { n: h })}
                </option>
              ))}
            </select>
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('reason')}
            <Input name="reason" required placeholder={t('reasonPlaceholder')} maxLength={500} />
          </Label>
          <Button type="submit" disabled={pending}>
            {t('grant')}
          </Button>
        </form>
      )}
    </Card>
  );
}
