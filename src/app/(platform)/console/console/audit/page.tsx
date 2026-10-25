import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requirePlatformStaff } from '@/lib/platform/staff';
import { listPlatformAudit } from '@/features/console-audit/queries';
import { StaffAuditTable } from '@/features/console-audit/components/StaffAuditTable';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('console.audit'))('title') };
}

export default async function StaffAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ staff?: string; action?: string }>;
}) {
  await requirePlatformStaff('/console/audit');
  const sp = await searchParams;
  const filters = {
    staff: sp.staff && /^[0-9a-f-]{36}$/i.test(sp.staff) ? sp.staff : undefined,
    action: sp.action && /^[a-z_.]{1,60}$/.test(sp.action) ? sp.action : undefined,
  };
  const [{ rows, staff }, t] = await Promise.all([listPlatformAudit(filters), getTranslations('console.audit')]);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' });
  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <p className="text-muted-foreground">{t('intro')}</p>
      </div>
      <StaffAuditTable
        rows={rows}
        staff={staff}
        filters={filters}
        when={Object.fromEntries(rows.map((r) => [r.id, fmt(r.at)]))}
      />
    </>
  );
}
