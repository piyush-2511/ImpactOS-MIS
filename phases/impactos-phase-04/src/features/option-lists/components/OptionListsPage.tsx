'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PlusIcon, RotateCcwIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/patterns/DataTable/DataTable';
import { FilterBar } from '@/components/patterns/FilterBar';
import { ExportMenu } from '@/components/patterns/ExportMenu';
import { ImportWizard } from '@/components/patterns/ImportWizard/ImportWizard';
import { SavedViews, type SavedView } from '@/components/patterns/SavedViews';
import { StatusChip } from '@/components/patterns/StatusChip';
import { useCan } from '@/hooks/useCan';
import type { ResolvedField } from '@/lib/fields/types';
import { cn } from '@/lib/utils';
import { exportValuesAction, resetValueAction } from '../actions';
import type { ListSummary, ValueRow } from '../queries';
import { OptionListEditor } from './OptionListEditor';

type Props = {
  lists: ListSummary[];
  listKey: string;
  rows: ValueRow[];
  total: number;
  page: number;
  size: number;
  sort: { key: string; dir: 'asc' | 'desc' } | null;
  fields: ResolvedField[];
  activeFacets: { value: string; n: number }[];
  views: SavedView[];
  query: string;
};

/**
 * Admin → Option lists. The reference page for the shared engine: list sidebar, filter bar with counts, data table
 * with sorting and paging, saved views, export, "Download sample" and import with undo.
 */
export function OptionListsPage({
  lists,
  listKey,
  rows,
  total,
  page,
  size,
  sort,
  fields,
  activeFacets,
  views,
  query,
}: Props) {
  const t = useTranslations('engine.lists');
  const router = useRouter();
  const canEdit = useCan('admin.lists.manage');
  const canExport = useCan('data.export');
  const canImport = useCan('data.import');
  const [editing, setEditing] = useState<ValueRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const label = (k: string) => fields.find((f) => f.key === k)?.label ?? k;
  const current = lists.find((l) => l.key === listKey);

  const columns: Column<ValueRow>[] = fields
    .filter((f) => f.showInTable)
    .map((f) => ({
      key: f.key,
      label: f.label,
      locked: f.locked,
      sortable: ['label_en', 'value_key', 'sort_order'].includes(f.key),
      align: f.type === 'number' ? 'right' : 'left',
      cell: (r: ValueRow) => {
        if (f.key === 'active')
          return <StatusChip status={r.active ? 'active' : 'no'} label={r.active ? t('inUse') : t('hidden')} />;
        if (f.key === 'label_en')
          return (
            <span className="flex items-center gap-2">
              {r.color && <span className="size-3 rounded-full" style={{ background: r.color }} aria-hidden />}
              <span className="font-semibold">{r.label_en}</span>
              {r.is_default && <Badge tone="neutral">{r.overridden ? t('changedDefault') : t('default')}</Badge>}
            </span>
          );
        if (f.key === 'value_key') return <span className="font-mono text-xs">{r.value_key}</span>;
        if (f.key === 'label_hi') return <span lang="hi">{r.label_hi ?? '—'}</span>;
        return String((r as Record<string, unknown>)[f.key] ?? '—');
      },
    }));
  if (canEdit) {
    columns.push({
      key: '_actions',
      label: t('actions'),
      locked: true,
      cell: (r) =>
        r.overridden || !r.is_default ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            aria-label={r.is_default ? t('resetAria', { name: r.label_en }) : t('deleteAria', { name: r.label_en })}
            onClick={() =>
              start(async () => {
                const res = await resetValueAction({ listKey, valueKey: r.value_key });
                if (res.ok) {
                  toast.success(r.is_default ? t('reset') : t('deleted'));
                  router.refresh();
                } else toast.error(t(`errors.${res.error}`));
              })
            }
          >
            <RotateCcwIcon aria-hidden /> {r.is_default ? t('resetShort') : t('deleteShort')}
          </Button>
        ) : null,
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <nav aria-label={t('lists')} className="flex flex-col gap-1 self-start rounded-xl bg-card p-2 shadow-sm">
        {lists.map((l) => (
          <Link
            key={l.key}
            href={`/admin/option-lists?list=${l.key}`}
            aria-current={l.key === listKey ? 'page' : undefined}
            className={cn(
              'flex items-center justify-between rounded-lg px-3 py-2 text-sm text-foreground no-underline hover:bg-secondary',
              l.key === listKey && 'bg-accent font-semibold',
            )}
          >
            {l.label}
            <span className="font-mono text-xs text-muted-foreground">{l.count}</span>
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">{current?.label}</h2>
          <div className="flex flex-wrap gap-2">
            <SavedViews entity="lookup_values" views={views} />
            {canExport && <ExportMenu onExport={(format) => exportValuesAction({ listKey, format, query })} />}
            {canImport && canEdit && (
              <ImportWizard entity="lookup_values" context={{ list_key: listKey }} title={current?.label ?? ''} />
            )}
            {canEdit && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <PlusIcon aria-hidden /> {t('add')}
              </Button>
            )}
          </div>
        </div>
        <FilterBar
          searchPlaceholder={t('search')}
          total={t('count', { n: total })}
          filters={[
            {
              key: 'active',
              label: label('active'),
              type: 'multi',
              options: activeFacets.map((f) => ({
                value: f.value,
                label: f.value === 'true' ? t('inUse') : t('hidden'),
                count: f.n,
              })),
            },
          ]}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.value_key}
          total={total}
          page={page}
          pageSize={size}
          sort={sort}
          viewKey={`lookup_values:${listKey}`}
          onRowClick={canEdit ? (r) => setEditing(r) : undefined}
          rowLabel={(r) => t('editAria', { name: r.label_en })}
          mobileTitle={(r) => r.label_en}
          mobileSubtitle={(r) => r.label_hi ?? r.value_key}
        />
      </div>
      {adding && <OptionListEditor listKey={listKey} value={null} open={adding} onOpenChange={setAdding} />}
      {editing && (
        <OptionListEditor
          key={editing.value_key}
          listKey={listKey}
          value={editing}
          open={!!editing}
          onOpenChange={(o) => !o && setEditing(null)}
        />
      )}
    </div>
  );
}
