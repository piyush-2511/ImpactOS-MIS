import { getTranslations } from 'next-intl/server';
import { Card, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { LimitKey } from '@/lib/supabase/database.types';
import { cn } from '@/lib/utils';

const n = (v: number) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v);

/** Usage vs plan limits. Amber at 80%, red at 100% (adding more is then refused, existing data is untouched). */
export async function UsageMeters({
  usage,
  limits,
}: {
  usage: Record<LimitKey, number>;
  limits: Partial<Record<LimitKey, number | null>>;
}) {
  const t = await getTranslations('billing.usage');
  const keys: LimitKey[] = ['staff_seats', 'storage_gb', 'custom_fields', 'ai_units', 'beneficiaries'];
  return (
    <Card className="flex flex-col gap-4">
      <CardTitle>{t('title')}</CardTitle>
      {keys.map((k) => {
        const limit = limits[k];
        const used = usage[k] ?? 0;
        const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
        return (
          <div key={k} className="flex flex-col gap-1.5">
            <div className="flex justify-between gap-2 text-sm">
              <span>{t(`keys.${k}`)}</span>
              <span className={cn('font-mono', pct >= 100 && 'text-bad-fg', pct >= 80 && pct < 100 && 'text-warn-fg')}>
                {limit === null || limit === undefined
                  ? t('unlimited', { used: n(used) })
                  : t('ofLimit', { used: n(used), limit: n(limit) })}
              </span>
            </div>
            {limit ? (
              <Progress
                value={pct}
                aria-label={t(`keys.${k}`)}
                className={cn(pct >= 100 && '[&>div]:bg-[#C2410C]', pct >= 80 && pct < 100 && '[&>div]:bg-[#D9822B]')}
              />
            ) : null}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">{t('note')}</p>
    </Card>
  );
}
