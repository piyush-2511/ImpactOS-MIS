import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { requirePermission } from '@/lib/authz/can';
import { requireUser } from '@/lib/auth/user';
import { formatDateNumeric } from '@/lib/i18n/format';
import { listActorsForFilter, listAuditEvents, type AuditFilters } from '@/features/activity-logs/queries';
import { AuditTable } from '@/features/activity-logs/components/AuditTable';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('admin.audit'))('title') };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireUser('/admin/activity-logs');
  const active = await requirePermission('admin.audit.view');
  const sp = await searchParams;
  const filters: AuditFilters = {
    actor: sp.actor && UUID.test(sp.actor) ? sp.actor : undefined,
    table: sp.table && /^[a-z_]+$/.test(sp.table) ? sp.table : undefined,
    from: sp.from && DATE.test(sp.from) ? sp.from : undefined,
    to: sp.to && DATE.test(sp.to) ? sp.to : undefined,
    page: Number(sp.page) > 0 ? Math.min(Number(sp.page), 1000) : 1,
  };
  const [{ rows, hasMore }, actors, t] = await Promise.all([
    listAuditEvents(active.organization.id, filters),
    listActorsForFilter(active.organization.id),
    getTranslations('admin'),
  ]);
  void (await getLocale());
  const when = Object.fromEntries(
    rows.map((r) => [
      r.id,
      `${formatDateNumeric(r.created_at)} ${new Date(r.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })}`,
    ]),
  );
  return (
    <>
      <div>
        <p className="text-[13px] text-muted-foreground">{t('crumb')}</p>
        <h1 className="text-2xl font-bold">{t('audit.title')}</h1>
        <p className="text-muted-foreground">{t('audit.intro')}</p>
      </div>
      <AuditTable rows={rows} actors={actors} filters={filters} hasMore={hasMore} when={when} />
    </>
  );
}
