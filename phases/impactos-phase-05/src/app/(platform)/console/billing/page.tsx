import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { formatDate } from '@/lib/i18n/format';
import { requirePlatformStaff } from '@/lib/platform/staff';
import { consoleBilling } from '@/features/console-billing/queries';
import { InvoiceRunPanel } from '@/features/console-billing/components/InvoiceRunPanel';
import { InvoicesTable } from '@/features/console-billing/components/InvoicesTable';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('console.billing'))('title') };
}

export default async function ConsoleBillingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePlatformStaff('/console/billing');
  const [data, t] = await Promise.all([
    consoleBilling((await searchParams).status),
    getTranslations('console.billing'),
  ]);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  return (
    <>
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <InvoiceRunPanel due={data.dueCount} />
      <InvoicesTable
        invoices={data.invoices}
        pending={data.pending}
        today={today}
        dates={Object.fromEntries(data.invoices.filter((i) => i.dueAt).map((i) => [i.id, formatDate(i.dueAt!)]))}
      />
    </>
  );
}
