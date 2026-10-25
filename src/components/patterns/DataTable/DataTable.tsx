'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowDownIcon, ArrowUpIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PAGE_SIZES, withParams } from '@/lib/views/filters';
import { cn } from '@/lib/utils';
import { BulkBar } from './BulkBar';
import { ColumnMenu } from './ColumnMenu';
import { MobileCards } from './MobileCards';

export type Column<T> = {
  key: string;
  label: string;
  cell: (row: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right';
  locked?: boolean;
  className?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  total: number;
  page: number;
  pageSize: number;
  sort?: { key: string; dir: 'asc' | 'desc' } | null;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  selectable?: boolean;
  bulkActions?: (selected: T[], clear: () => void) => React.ReactNode;
  mobileTitle: (row: T) => React.ReactNode;
  mobileSubtitle?: (row: T) => React.ReactNode;
  empty?: React.ReactNode;
  /** Remembers this viewer's hidden columns for the entity (organisation defaults come from field settings). */
  viewKey?: string;
  toolbar?: React.ReactNode;
};

/**
 * The list table for every module: server-side paging and sorting through the URL, column picker, selection with a
 * bulk-action bar, sticky header, keyboard-openable rows, and cards on phones.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  total,
  page,
  pageSize,
  sort,
  onRowClick,
  rowLabel,
  selectable,
  bulkActions,
  mobileTitle,
  mobileSubtitle,
  empty,
  viewKey,
  toolbar,
}: Props<T>) {
  const t = useTranslations('engine.table');
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [hidden, setHidden] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!viewKey) return;
    try {
      const saved = JSON.parse(window.localStorage.getItem(`ios:cols:${viewKey}`) ?? '[]');
      // Restoring per-viewer column choice after mount (localStorage is unavailable during server render).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setHidden(saved.filter((x) => typeof x === 'string'));
    } catch {
      /* ignore */
    }
  }, [viewKey]);
  const changeHidden = (h: string[]) => {
    setHidden(h);
    if (viewKey) {
      try {
        window.localStorage.setItem(`ios:cols:${viewKey}`, JSON.stringify(h));
      } catch {
        /* storage full or blocked */
      }
    }
  };

  const visible = useMemo(() => columns.filter((c) => c.locked || !hidden.includes(c.key)), [columns, hidden]);
  const go = (changes: Record<string, string | undefined>) =>
    router.push(`${path}${withParams(sp.toString(), changes)}`, { scroll: false });
  const toggleSort = (key: string) => go({ sort: sort?.key === key && sort.dir === 'asc' ? `-${key}` : key });
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(rowKey(r)));
  const selectedRows = rows.filter((r) => selected.has(rowKey(r)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {toolbar}
        <ColumnMenu
          columns={columns.map((c) => ({ key: c.key, label: c.label, locked: c.locked }))}
          hidden={hidden}
          onChange={changeHidden}
        />
      </div>
      {rows.length === 0 ? (
        (empty ?? <p className="rounded-xl bg-card p-6 text-center text-muted-foreground">{t('empty')}</p>)
      ) : (
        <>
          <div className="hidden max-h-[70vh] overflow-auto rounded-xl bg-card shadow-sm md:block">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-card">
                <TableRow>
                  {selectable && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allOnPage}
                        onCheckedChange={(v) => setSelected(v === true ? new Set(rows.map(rowKey)) : new Set())}
                        aria-label={t('selectPage')}
                      />
                    </TableHead>
                  )}
                  {visible.map((c) => (
                    <TableHead
                      key={c.key}
                      className={cn(c.align === 'right' && 'text-right', c.className)}
                      aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                    >
                      {c.sortable ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort(c.key)}
                        >
                          {c.label}
                          {sort?.key === c.key &&
                            (sort.dir === 'asc' ? (
                              <ArrowUpIcon className="size-3.5" aria-hidden />
                            ) : (
                              <ArrowDownIcon className="size-3.5" aria-hidden />
                            ))}
                        </button>
                      ) : (
                        c.label
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const id = rowKey(r);
                  return (
                    <TableRow
                      key={id}
                      data-state={selected.has(id) ? 'selected' : undefined}
                      className={cn(onRowClick && 'cursor-pointer')}
                      tabIndex={onRowClick ? 0 : undefined}
                      aria-label={rowLabel?.(r)}
                      onClick={(e) => {
                        if (onRowClick && !(e.target as HTMLElement).closest('button,a,input,[role=checkbox]'))
                          onRowClick(r);
                      }}
                      onKeyDown={(e) => {
                        if (onRowClick && (e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
                          e.preventDefault();
                          onRowClick(r);
                        }
                      }}
                    >
                      {selectable && (
                        <TableCell>
                          <Checkbox
                            checked={selected.has(id)}
                            onCheckedChange={(v) => toggle(id, v === true)}
                            aria-label={rowLabel?.(r)}
                          />
                        </TableCell>
                      )}
                      {visible.map((c) => (
                        <TableCell
                          key={c.key}
                          className={cn(c.align === 'right' && 'text-right font-mono', c.className)}
                        >
                          {c.cell(r)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <MobileCards
            rows={rows}
            rowKey={rowKey}
            title={mobileTitle}
            subtitle={mobileSubtitle}
            rowLabel={rowLabel}
            onOpen={onRowClick}
            fields={visible.filter((c) => !c.locked).map((c) => ({ key: c.key, label: c.label, cell: c.cell }))}
            selectable={selectable}
            selected={selected}
            onToggle={toggle}
          />
        </>
      )}
      <nav
        aria-label={t('pagination')}
        className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
      >
        <span>{t('showing', { from, to, total })}</span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2">
            {t('perPage')}
            <select
              value={pageSize}
              onChange={(e) => go({ size: e.target.value })}
              className="min-h-9 rounded-lg border border-input bg-card px-2"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>
            {t('previous')}
          </Button>
          <span className="font-mono">
            {page} / {pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => go({ page: String(page + 1) })}>
            {t('next')}
          </Button>
        </div>
      </nav>
      {selectable && bulkActions && (
        <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
          {bulkActions(selectedRows, () => setSelected(new Set()))}
        </BulkBar>
      )}
    </div>
  );
}
