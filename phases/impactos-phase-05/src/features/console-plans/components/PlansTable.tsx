import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPaise } from '@/lib/billing/plans';
import type { PlanRow } from '../queries';
import { PlanEditor } from './PlanEditor';

const feeLabel = (bps: number, cap: number) => `${bps / 100}% · ${formatPaise(cap)}`;

export async function PlansTable({ plans, canEdit }: { plans: PlanRow[]; canEdit: boolean }) {
  const t = await getTranslations('console.plans');
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('name')}</TableHead>
          <TableHead className="text-right">{t('monthly')}</TableHead>
          <TableHead className="text-right">{t('annual')}</TableHead>
          <TableHead className="text-right">{t('limitNames.staff_seats')}</TableHead>
          <TableHead className="text-right">{t('limitNames.storage_gb')}</TableHead>
          <TableHead className="text-right">{t('fee')}</TableHead>
          <TableHead className="text-right">{t('subscribers')}</TableHead>
          <TableHead>
            <span className="sr-only">{t('edit')}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plans.map((p) => (
          <TableRow key={p.key}>
            <TableCell>
              <span className="font-semibold">{p.name}</span> {!p.active && <Badge tone="bad">{t('inactive')}</Badge>}{' '}
              {!p.isPublic && <Badge>{t('private')}</Badge>}
            </TableCell>
            <TableCell className="text-right font-mono">{formatPaise(p.monthlyPaise)}</TableCell>
            <TableCell className="text-right font-mono">{formatPaise(p.annualPaise)}</TableCell>
            <TableCell className="text-right font-mono">{p.limits.staff_seats ?? '∞'}</TableCell>
            <TableCell className="text-right font-mono">{p.limits.storage_gb ?? '∞'}</TableCell>
            <TableCell className="text-right font-mono">{feeLabel(p.donationFeeBps, p.donationFeeCapPaise)}</TableCell>
            <TableCell className="text-right font-mono">{p.subscribers}</TableCell>
            <TableCell className="text-right">{canEdit && <PlanEditor plan={p} />}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
