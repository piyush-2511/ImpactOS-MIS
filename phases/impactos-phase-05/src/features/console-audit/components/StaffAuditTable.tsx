import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Row = {
  id: number;
  at: string;
  staff: string;
  action: string;
  org: string | null;
  target: string | null;
  details: unknown;
};

export async function StaffAuditTable({
  rows,
  staff,
  filters,
  when,
}: {
  rows: Row[];
  staff: { id: string; name: string }[];
  filters: { staff?: string; action?: string };
  when: Record<number, string>;
}) {
  const t = await getTranslations('console.audit');
  return (
    <div className="flex flex-col gap-3">
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl bg-card p-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('staff')}
          <select
            name="staff"
            defaultValue={filters.staff ?? ''}
            className="min-h-10 rounded-lg border border-input bg-card px-2 font-normal"
          >
            <option value="">{t('anyone')}</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          {t('action')}
          <input
            name="action"
            defaultValue={filters.action ?? ''}
            placeholder="billing."
            className="min-h-10 rounded-lg border border-input bg-card px-2 font-mono font-normal"
          />
        </label>
        <Button type="submit" size="sm">
          {t('apply')}
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('when')}</TableHead>
            <TableHead>{t('staff')}</TableHead>
            <TableHead>{t('action')}</TableHead>
            <TableHead>{t('org')}</TableHead>
            <TableHead>{t('target')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap font-mono text-xs">{when[r.id]}</TableCell>
              <TableCell>{r.staff}</TableCell>
              <TableCell className="font-mono text-sm">{r.action}</TableCell>
              <TableCell>{r.org ?? '—'}</TableCell>
              <TableCell className="max-w-64 truncate font-mono text-xs">{r.target ?? '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
