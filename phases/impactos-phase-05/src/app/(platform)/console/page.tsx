import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { KpiCards } from '@/components/patterns/KpiCards';
import { Card, CardTitle } from '@/components/ui/card';
import { formatPaise } from '@/lib/billing/plans';
import { requirePlatformStaff } from '@/lib/platform/staff';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Issued invoices whose due date has passed. */
function overdueOf<T extends { due_at: string | null }>(open: T[] | null): T[] {
  const now = Date.now();
  return (open ?? []).filter((i) => i.due_at && new Date(i.due_at).getTime() < now);
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('console.overview'))('title') };
}

/** Console home: the business at a glance (service-role aggregates, staff only). */
export default async function ConsoleHome() {
  await requirePlatformStaff('/console');
  const t = await getTranslations('console.overview');
  const db = supabaseAdmin();
  const [{ data: subs }, { data: open }, { count: toConfirm }, { count: tickets }] = await Promise.all([
    db
      .from('subscriptions')
      .select(
        'status, billing_period, plan:plans(monthly_paise, annual_paise), org:organizations(name), organization_id',
      ),
    db.from('invoices').select('organization_id, total_paise, paid_paise, due_at').eq('status', 'issued'),
    db.from('billing_payments').select('*', { count: 'exact', head: true }).eq('status', 'submitted'),
    db.from('support_tickets').select('*', { count: 'exact', head: true }).neq('status', 'closed'),
  ]);
  const paying = (subs ?? []).filter((s) => ['active', 'past_due'].includes(s.status));
  const mrr = paying.reduce(
    (sum, s) =>
      sum +
      (s.billing_period === 'annual' ? Math.round((s.plan?.annual_paise ?? 0) / 12) : (s.plan?.monthly_paise ?? 0)),
    0,
  );
  const overdue = overdueOf(open);
  const attention = (subs ?? []).filter((s) => ['past_due', 'read_only'].includes(s.status));
  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <KpiCards
        items={[
          {
            label: t('paying'),
            value: String(paying.length),
            note: t('trialing', { n: (subs ?? []).filter((s) => s.status === 'trialing').length }),
          },
          { label: t('mrr'), value: formatPaise(mrr), note: t('beforeGst') },
          {
            label: t('overdue'),
            value: String(overdue.length),
            note: formatPaise(overdue.reduce((s, i) => s + i.total_paise - i.paid_paise, 0)),
            tone: overdue.length ? 'warn' : undefined,
            href: '/console/billing?status=issued',
          },
          {
            label: t('toConfirm'),
            value: String(toConfirm ?? 0),
            note: t('openTickets', { n: tickets ?? 0 }),
            href: '/console/billing',
          },
        ]}
      />
      <Card className="flex flex-col gap-2">
        <CardTitle>{t('attention')}</CardTitle>
        {attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('allGood')}</p>
        ) : (
          <ul className="flex flex-col">
            {attention.map((s) => (
              <li
                key={s.organization_id}
                className="flex justify-between gap-3 border-t border-border/60 py-2 first:border-t-0"
              >
                <Link href={`/console/tenants/${s.organization_id}`}>{s.org?.name}</Link>
                <span className="text-sm text-muted-foreground">{t(`statuses.${s.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
