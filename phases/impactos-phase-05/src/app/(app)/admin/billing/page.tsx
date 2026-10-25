import type { Metadata } from 'next';
import QRCode from 'qrcode';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/authz/can';
import { requireUser } from '@/lib/auth/user';
import { platformPayee, upiLink } from '@/lib/billing/invoice-run';
import { formatPaise } from '@/lib/billing/plans';
import { billingOverview } from '@/features/billing/queries';
import { PlanCard } from '@/features/billing/components/PlanCard';
import { UsageMeters } from '@/features/billing/components/UsageMeters';
import { InvoicesList } from '@/features/billing/components/InvoicesList';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('billing'))('title') };
}

/** Admin → Billing: plan, usage, invoices, pay (UPI / bank + UTR). Works in read-only mode. */
export default async function BillingPage() {
  await requireUser('/admin/billing');
  const active = await requirePermission('admin.billing.manage');
  const orgId = active.organization.id;
  const locale = (await getLocale()) === 'hi' ? 'hi' : 'en';
  const [{ plan, usage, options, invoices, unbilledPaise }, t] = await Promise.all([
    billingOverview(orgId),
    getTranslations('billing'),
  ]);
  const payee = platformPayee();
  const qr: Record<string, { svg: string | null; href: string | null }> = {};
  for (const i of invoices.filter((x) => x.status === 'issued' && x.number)) {
    const href = upiLink(i.totalPaise - i.paidPaise, i.number!);
    qr[i.id] = { href, svg: href ? await QRCode.toString(href, { type: 'svg', margin: 1 }) : null };
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  return (
    <>
      <div>
        <p className="text-[13px] text-muted-foreground">{t('crumb')}</p>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {plan && <PlanCard plan={plan} options={options} locale={locale} canManage />}
        <UsageMeters usage={usage} limits={plan?.limits ?? {}} />
      </div>
      {unbilledPaise > 0 && (
        <p className="rounded-lg bg-info-bg px-3 py-2 text-sm text-info-fg">
          {t('unbilled', { amount: formatPaise(unbilledPaise, locale) })}
        </p>
      )}
      <InvoicesList invoices={invoices} locale={locale} payee={payee} qr={qr} today={today} />
      <p className="text-xs text-muted-foreground">{t('dataPromise')}</p>
    </>
  );
}
