import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { AuditFilters, AuditRow } from '../queries';
import { DiffView } from './DiffView';

const TABLES = [
  'organization_members',
  'member_roles',
  'member_scopes',
  'invitations',
  'username_accounts',
  'roles',
  'role_permissions',
  'positions',
  'position_holders',
  'organizations',
];

function tone(action: string): 'ok' | 'bad' | 'info' | 'warn' | 'neutral' {
  if (action === 'insert') return 'ok';
  if (action === 'delete') return 'bad';
  if (action.startsWith('reveal')) return 'warn';
  if (action === 'update') return 'info';
  return 'neutral';
}

/** Server-rendered, filterable activity log. Filters are a GET form so views can be bookmarked and shared. */
export async function AuditTable({
  rows,
  actors,
  filters,
  hasMore,
  when,
}: {
  rows: AuditRow[];
  actors: { id: string; name: string }[];
  filters: AuditFilters;
  hasMore: boolean;
  when: Record<number, string>;
}) {
  const t = await getTranslations('admin.audit');
  const page = filters.page ?? 1;
  const qs = (p: number) => {
    const s = new URLSearchParams(
      Object.entries({ ...filters, page: String(p) }).filter(([, v]) => v) as [string, string][],
    );
    return `?${s}`;
  };
  return (
    <div className="flex flex-col gap-4">
      <form method="get" className="grid gap-3 rounded-xl bg-card p-3 sm:grid-cols-2 lg:grid-cols-6">
        <label className="flex flex-col gap-1 text-sm font-semibold lg:col-span-2">
          {t('who')}
          <select
            name="actor"
            defaultValue={filters.actor ?? ''}
            className="min-h-10 rounded-lg border border-input bg-card px-2 font-normal"
          >
            <option value="">{t('anyone')}</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('what')}
          <select
            name="table"
            defaultValue={filters.table ?? ''}
            className="min-h-10 rounded-lg border border-input bg-card px-2 font-normal"
          >
            <option value="">{t('anything')}</option>
            {TABLES.map((x) => (
              <option key={x} value={x}>
                {t(`tables.${x}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('from')}
          <Input type="date" name="from" defaultValue={filters.from} className="min-h-10" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('to')}
          <Input type="date" name="to" defaultValue={filters.to} className="min-h-10" />
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" size="sm">
            {t('apply')}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="?">{t('clear')}</Link>
          </Button>
        </div>
      </form>
      {rows.length === 0 ? (
        <p className="rounded-xl bg-card p-6 text-center text-muted-foreground">{t('empty')}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl bg-card">
              <details className="group">
                <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3">
                  <span className="w-36 shrink-0 font-mono text-xs text-muted-foreground">{when[r.id]}</span>
                  <span className="font-semibold">{r.actorName}</span>
                  <Badge tone={tone(r.action)}>
                    {t.has(`actions.${r.action}`) ? t(`actions.${r.action}`) : r.action}
                  </Badge>
                  {r.table_name && (
                    <span className="text-sm">
                      {t.has(`tables.${r.table_name}`) ? t(`tables.${r.table_name}`) : r.table_name}
                    </span>
                  )}
                  {r.note && <span className="text-sm text-muted-foreground">{r.note}</span>}
                  {r.actor_kind === 'platform' && <Badge tone="warn">{t('platform')}</Badge>}
                </summary>
                <div className="border-t border-border/60 px-4 py-3">
                  <DiffView before={r.before} after={r.after} changed={r.changed} />
                </div>
              </details>
            </li>
          ))}
        </ol>
      )}
      <div className="flex justify-between">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={qs(page - 1)}>{t('newer')}</Link>
          </Button>
        ) : (
          <span />
        )}
        {hasMore && (
          <Button asChild variant="outline" size="sm">
            <Link href={qs(page + 1)}>{t('older')}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
