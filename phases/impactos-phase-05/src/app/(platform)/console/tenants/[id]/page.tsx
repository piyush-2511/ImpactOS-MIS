import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { KpiCards } from '@/components/patterns/KpiCards';
import { formatPaise, trialDaysLeft } from '@/lib/billing/plans';
import { formatDate } from '@/lib/i18n/format';
import { requirePlatformStaff } from '@/lib/platform/staff';
import { logSupportView } from '@/lib/platform/support';
import { supportView, tenantDetail } from '@/features/console-tenants/queries';
import { TenantDetail } from '@/features/console-tenants/components/TenantDetail';
import { SupportSessionBanner } from '@/features/console-support/components/SupportSessionBanner';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('console.tenant'))('title') };
}

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const staff = await requirePlatformStaff(`/console/tenants/${id}`);
  const [d, t] = await Promise.all([tenantDetail(id), getTranslations('console.tenant')]);
  if (!d) notFound();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
  // Organisation data only under a grant, read with the staff member's own session; every view is logged for the NGO.
  const view =
    d.activeGrant && (await logSupportView(id, staff.userId, 'Console: members and recent activity'))
      ? await supportView(id)
      : null;
  return (
    <>
      <div>
        <Link href="/console/tenants" className="text-[13px] text-muted-foreground">
          {t('back')}
        </Link>
        <h1 className="text-2xl font-bold">{d.org.name}</h1>
        <p className="font-mono text-sm text-muted-foreground">
          {d.org.slug} · {d.org.state}
        </p>
      </div>
      <KpiCards
        items={[
          {
            label: t('status'),
            value: t(`statuses.${d.sub?.status ?? 'none'}`),
            note: d.sub?.status === 'trialing' ? t('trialLeft', { n: trialDaysLeft(d.sub.trial_ends_at) }) : undefined,
          },
          {
            label: t('plan'),
            value: d.sub?.plan_key ?? '—',
            note: d.sub?.pending_plan_key ? t('pending', { plan: d.sub.pending_plan_key }) : undefined,
          },
          { label: t('people'), value: String(d.members), note: t('seats', { n: d.seats }) },
          {
            label: t('owed'),
            value: formatPaise(
              d.invoices.filter((i) => i.status === 'issued').reduce((s, i) => s + i.total_paise - i.paid_paise, 0),
            ),
          },
        ]}
      />
      {d.sub && (
        <TenantDetail
          orgId={id}
          status={d.sub.status}
          planKey={d.sub.plan_key}
          period={d.sub.billing_period}
          plans={d.plans}
          notes={d.sub.console_notes ?? ''}
          trialing={d.sub.status === 'trialing'}
          hasGrant={!!d.activeGrant}
        />
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-2">
          <CardTitle>{t('invoices')}</CardTitle>
          {d.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noInvoices')}</p>
          ) : (
            d.invoices.map((i) => (
              <div
                key={i.id}
                className="flex justify-between gap-2 border-t border-border/60 py-1.5 text-sm first:border-t-0"
              >
                <span className="font-mono">{i.number}</span>
                <span className="font-mono">{formatPaise(i.total_paise)}</span>
                <Badge tone={i.status === 'paid' ? 'ok' : 'info'}>{i.status}</Badge>
              </div>
            ))
          )}
        </Card>
        <Card className="flex flex-col gap-2">
          <CardTitle>{t('tickets')}</CardTitle>
          {d.tickets.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noTickets')}</p>
          ) : (
            d.tickets.map((k) => (
              <div
                key={k.id}
                className="flex justify-between gap-2 border-t border-border/60 py-1.5 text-sm first:border-t-0"
              >
                <span>{k.subject}</span>
                <Badge>{k.status}</Badge>
              </div>
            ))
          )}
        </Card>
      </div>
      {view && d.activeGrant && (
        <section className="flex flex-col gap-3">
          <SupportSessionBanner
            org={d.org.name}
            until={fmt(d.activeGrant.expires_at)}
            breakGlass={d.activeGrant.break_glass}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="flex flex-col gap-2">
              <CardTitle>{t('members')}</CardTitle>
              {view.members.map((m) => (
                <div
                  key={m.id}
                  className="flex justify-between gap-2 border-t border-border/60 py-1.5 text-sm first:border-t-0"
                >
                  <span>{m.profile?.full_name ?? m.profile?.email ?? '—'}</span>
                  <span className="text-muted-foreground">
                    {m.base_role} · {m.status}
                  </span>
                </div>
              ))}
            </Card>
            <Card className="flex flex-col gap-2">
              <CardTitle>{t('activity')}</CardTitle>
              {view.events.map((e) => (
                <div
                  key={e.id}
                  className="flex justify-between gap-2 border-t border-border/60 py-1.5 text-sm first:border-t-0"
                >
                  <span className="font-mono text-xs">
                    {e.action} {e.table_name}
                  </span>
                  <span className="text-muted-foreground">{formatDate(e.created_at)}</span>
                </div>
              ))}
            </Card>
          </div>
        </section>
      )}
    </>
  );
}
