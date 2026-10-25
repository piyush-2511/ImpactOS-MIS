import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Card, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatPaise } from '@/lib/billing/plans';
import { formatDate } from '@/lib/i18n/format';
import type { InvoiceRow } from '../queries';
import { PayDialog, type Payee } from './PayDialog';

const periodLabel = (a: string, b: string, l: 'en' | 'hi') => `${formatDate(a, l)} – ${formatDate(b, l)}`;

/** Invoices with PDF, status, reported payments and Pay. */
export async function InvoicesList({
  invoices,
  locale,
  payee,
  qr,
  today,
}: {
  invoices: InvoiceRow[];
  locale: 'en' | 'hi';
  payee: Payee;
  qr: Record<string, { svg: string | null; href: string | null }>;
  today: string;
}) {
  const t = await getTranslations('billing.invoices');
  return (
    <Card className="flex flex-col gap-3 p-0">
      <CardTitle className="px-5 pt-5">{t('title')}</CardTitle>
      {invoices.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">{t('none')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('number')}</TableHead>
              <TableHead>{t('period')}</TableHead>
              <TableHead>{t('due')}</TableHead>
              <TableHead className="text-right">{t('amount')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>
                <span className="sr-only">{t('actions')}</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((i) => {
              const submitted = i.payments.some((p) => p.status === 'submitted');
              const tone = i.status === 'paid' ? 'ok' : i.overdue ? 'warn' : submitted ? 'info' : 'neutral';
              const label =
                i.status === 'paid'
                  ? t('paid')
                  : i.status === 'void'
                    ? t('void')
                    : submitted
                      ? t('checking')
                      : i.overdue
                        ? t('overdue')
                        : t('open');
              return (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-sm">
                    {i.pdfFileId ? <a href={`/api/files/${i.pdfFileId}`}>{i.number}</a> : i.number}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {periodLabel(i.periodStart, i.periodEnd, locale)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm">
                    {i.dueAt ? formatDate(i.dueAt, locale) : '—'}
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatPaise(i.totalPaise, locale)}</TableCell>
                  <TableCell>
                    <Badge tone={tone}>{label}</Badge>
                    {submitted && (
                      <div className="mt-1 font-mono text-xs text-muted-foreground">
                        {i.payments.find((p) => p.status === 'submitted')?.utr}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {i.status === 'issued' && !submitted && i.number && (
                      <PayDialog
                        invoiceId={i.id}
                        number={i.number}
                        amountLabel={formatPaise(i.totalPaise - i.paidPaise, locale)}
                        amountRupees={(i.totalPaise - i.paidPaise) / 100}
                        qrSvg={qr[i.id]?.svg ?? null}
                        upiHref={qr[i.id]?.href ?? null}
                        payee={payee}
                        today={today}
                      />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}
