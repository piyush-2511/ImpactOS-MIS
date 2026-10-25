'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPaise } from '@/lib/billing/plans';
import { formatDate } from '@/lib/i18n/format';
import { confirmPaymentAction, rejectPaymentAction } from '../actions';
import type { ConsoleInvoice, PendingPayment } from '../queries';
import { CreditNoteDialog } from './CreditNoteDialog';
import { MarkPaidDialog } from './MarkPaidDialog';

const bracket = (s: string) => `(${s})`;

/** Payments to confirm (top) and all invoices. Match each UTR against the bank statement before confirming. */
export function InvoicesTable({
  invoices,
  pending,
  dates,
  today,
}: {
  invoices: ConsoleInvoice[];
  pending: PendingPayment[];
  dates: Record<string, string>;
  today: string;
}) {
  const t = useTranslations('console.billing');
  const router = useRouter();
  const [busy, start] = useTransition();
  const act = (fn: () => Promise<{ ok: boolean }>, msg: string) =>
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(msg);
        router.refresh();
      } else toast.error(t('failed'));
    });
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-0">
        <CardTitle className="px-5 pt-5">{t('toConfirm', { n: pending.length })}</CardTitle>
        {pending.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">{t('nothingToConfirm')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('org')}</TableHead>
                <TableHead>{t('invoice')}</TableHead>
                <TableHead>{t('utr')}</TableHead>
                <TableHead>{t('paidOn')}</TableHead>
                <TableHead className="text-right">{t('amount')}</TableHead>
                <TableHead>
                  <span className="sr-only">{t('actions')}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pending.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-semibold">{p.orgName}</TableCell>
                  <TableCell className="font-mono text-sm">{p.invoiceNumber}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {p.utr} <span className="text-xs text-muted-foreground">{bracket(p.method)}</span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(p.paidOn)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatPaise(p.amountPaise)}
                    {p.amountPaise !== p.invoiceTotal && (
                      <Badge tone="warn" className="ml-2">
                        {t('differs')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => act(() => confirmPaymentAction({ paymentId: p.id }), t('confirmed'))}
                    >
                      {t('confirm')}
                    </Button>{' '}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        act(() => rejectPaymentAction({ paymentId: p.id, note: t('notFoundNote') }), t('rejected'))
                      }
                    >
                      {t('reject')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Card className="flex flex-col gap-3 p-0">
        <CardTitle className="px-5 pt-5">{t('invoices')}</CardTitle>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('invoice')}</TableHead>
              <TableHead>{t('org')}</TableHead>
              <TableHead>{t('due')}</TableHead>
              <TableHead className="text-right">{t('total')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>
                <span className="sr-only">{t('actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-mono text-sm">{i.number}</TableCell>
                <TableCell>{i.orgName}</TableCell>
                <TableCell className="whitespace-nowrap">{dates[i.id] ?? '—'}</TableCell>
                <TableCell className="text-right font-mono">{formatPaise(i.totalPaise)}</TableCell>
                <TableCell>
                  <Badge tone={i.status === 'paid' ? 'ok' : i.overdue ? 'warn' : 'info'}>
                    {t(i.status === 'issued' && i.overdue ? 'overdue' : `statuses.${i.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  {i.status === 'issued' && i.number && (
                    <MarkPaidDialog
                      invoiceId={i.id}
                      number={i.number}
                      dueRupees={(i.totalPaise - i.paidPaise) / 100}
                      today={today}
                    />
                  )}
                  <CreditNoteDialog orgId={i.orgId} invoiceId={i.id} number={i.number} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
