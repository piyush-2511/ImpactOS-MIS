'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitPaymentAction } from '../actions';

export type Payee = { name: string; upi?: string; bankName?: string; account?: string; ifsc?: string };

/** How to pay an invoice: UPI QR / app link for the exact amount, or bank transfer; then report the UTR. */
export function PayDialog({
  invoiceId,
  number,
  amountLabel,
  amountRupees,
  qrSvg,
  upiHref,
  payee,
  today,
}: {
  invoiceId: string;
  number: string;
  amountLabel: string;
  amountRupees: number;
  qrSvg: string | null;
  upiHref: string | null;
  payee: Payee;
  today: string;
}) {
  const t = useTranslations('billing.pay');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">{t('pay')}</Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('title', { number, amount: amountLabel })}</DialogTitle>
          <DialogDescription>{t('intro')}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
          {qrSvg && (
            <div
              className="size-40 rounded-lg bg-white p-2"
              role="img"
              aria-label={t('qrAlt', { amount: amountLabel })}
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          )}
          <dl className="flex flex-col gap-1 text-sm">
            {payee.upi && (
              <div>
                <dt className="text-muted-foreground">{t('upi')}</dt>
                <dd className="font-mono font-semibold">{payee.upi}</dd>
              </div>
            )}
            {payee.account && (
              <div>
                <dt className="text-muted-foreground">{t('bank')}</dt>
                <dd className="font-mono">
                  {payee.name} · {payee.bankName} · {payee.account} · {payee.ifsc}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">{t('reference')}</dt>
              <dd className="font-mono font-semibold">{number}</dd>
            </div>
            {upiHref && (
              <a href={upiHref} className="mt-1 text-sm font-semibold md:hidden">
                {t('openUpiApp')}
              </a>
            )}
          </dl>
        </div>
        <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">{t('fc')}</p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            start(async () => {
              const r = await submitPaymentAction({
                invoiceId,
                amountRupees: fd.get('amount'),
                method: fd.get('method'),
                utr: fd.get('utr'),
                paidOn: fd.get('paidOn'),
              });
              if (!r.ok) return void setErrors(r.fieldErrors ?? { form: r.error === 'conflict' ? 'utrUsed' : r.error });
              toast.success(t('submitted'));
              setOpen(false);
              router.refresh();
            })
          }
        >
          {errors.form && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {t(`errors.${errors.form}`)}
            </p>
          )}
          <Label className="flex flex-col items-start gap-1">
            {t('utr')}
            <Input name="utr" required className="font-mono uppercase" aria-invalid={!!errors.utr} />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('method')}
            <select
              name="method"
              defaultValue="upi"
              className="min-h-11 w-full rounded-lg border border-input bg-card px-2 font-normal"
            >
              {(['upi', 'bank', 'cheque', 'other'] as const).map((m) => (
                <option key={m} value={m}>
                  {t(`methods.${m}`)}
                </option>
              ))}
            </select>
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('amount')}
            <Input
              name="amount"
              type="number"
              step="0.01"
              min="1"
              defaultValue={amountRupees}
              required
              aria-invalid={!!errors.amountRupees}
            />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('paidOn')}
            <Input name="paidOn" type="date" max={today} defaultValue={today} required />
          </Label>
          {(errors.utr || errors.amountRupees) && (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {t(`errors.${errors.utr ?? errors.amountRupees}`)}
            </p>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
