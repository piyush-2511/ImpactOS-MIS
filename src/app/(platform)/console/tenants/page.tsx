import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { FilterBar } from '@/components/patterns/FilterBar';
import { formatPaise } from '@/lib/billing/plans';
import { formatDate } from '@/lib/i18n/format';
import { requirePlatformStaff } from '@/lib/platform/staff';
import { parseListQuery } from '@/lib/views/filters';
import { listTenants } from '@/features/console-tenants/queries';
import { TenantsTable } from '@/features/console-tenants/components/TenantsTable';
import { CreateTenantDialog } from '@/features/console-tenants/components/CreateTenantDialog';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('console.tenants'))('title') };
}

const STATUSES = ['trialing', 'active', 'past_due', 'read_only', 'cancelled'];

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const staff = await requirePlatformStaff('/console/tenants');
  const sp = await searchParams;
  const q = parseListQuery(sp, { filters: ['status'], sorts: [] });
  const [all, t] = await Promise.all([
    listTenants({ status: q.filters.status, q: q.q }),
    getTranslations('console.tenants'),
  ]);
  const rows = all.slice((q.page - 1) * q.size, q.page * q.size);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        {['super_admin', 'billing', 'support'].includes(staff.role) && <CreateTenantDialog />}
      </div>
      <FilterBar
        searchPlaceholder={t('search')}
        total={t('count', { n: all.length })}
        filters={[
          {
            key: 'status',
            label: t('status'),
            type: 'multi',
            options: STATUSES.map((s) => ({ value: s, label: t(`statuses.${s}`) })),
          },
        ]}
      />
      <TenantsTable
        rows={rows}
        total={all.length}
        page={q.page}
        size={q.size}
        owed={Object.fromEntries(rows.map((r) => [r.id, r.openInvoicesPaise ? formatPaise(r.openInvoicesPaise) : '—']))}
        when={Object.fromEntries(rows.filter((r) => r.lastActivity).map((r) => [r.id, formatDate(r.lastActivity!)]))}
      />
    </>
  );
}
