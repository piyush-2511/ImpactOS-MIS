'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { DataTable, type Column } from '@/components/patterns/DataTable/DataTable';
import { StatusChip } from '@/components/patterns/StatusChip';
import type { TenantRow } from '../queries';

export function TenantsTable({
  rows,
  owed,
  when,
  total,
  page,
  size,
}: {
  rows: TenantRow[];
  owed: Record<string, string>;
  when: Record<string, string>;
  total: number;
  page: number;
  size: number;
}) {
  const t = useTranslations('console.tenants');
  const router = useRouter();
  const tone = { trialing: 'info', active: 'ok', past_due: 'warn', read_only: 'bad', cancelled: 'bad' } as const;
  const columns: Column<TenantRow>[] = [
    {
      key: 'name',
      label: t('name'),
      locked: true,
      cell: (r) => (
        <span className="flex flex-col">
          <span className="font-semibold">{r.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{r.slug}</span>
        </span>
      ),
    },
    { key: 'plan', label: t('plan'), cell: (r) => r.planName },
    {
      key: 'status',
      label: t('status'),
      cell: (r) => (
        <StatusChip status={r.status} label={t(`statuses.${r.status}`)} tone={tone[r.status as keyof typeof tone]} />
      ),
    },
    { key: 'members', label: t('members'), align: 'right', cell: (r) => r.members },
    { key: 'storage', label: t('storage'), align: 'right', cell: (r) => `${r.storageMb} MB` },
    { key: 'owed', label: t('owed'), align: 'right', cell: (r) => owed[r.id] },
    { key: 'last', label: t('lastActivity'), cell: (r) => when[r.id] ?? '—' },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      total={total}
      page={page}
      pageSize={size}
      viewKey="console:tenants"
      onRowClick={(r) => router.push(`/console/tenants/${r.id}`)}
      rowLabel={(r) => t('open', { name: r.name })}
      mobileTitle={(r) => r.name}
      mobileSubtitle={(r) => `${r.planName} · ${t(`statuses.${r.status}`)}`}
    />
  );
}
