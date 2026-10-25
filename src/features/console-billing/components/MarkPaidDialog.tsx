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
import { recordPaymentAction } from '../actions';

/** Record a payment seen on ImpactOS's bank statement against an open invoice. */
export function MarkPaidDialog({
  invoiceId,
  number,
  dueRupees,
  today,
}: {
  invoiceId: string;
  number: string;
  dueRupees: number;
  today: string;
}) {
  const t = useTranslations('console.billing');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          {t('record')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('recordTitle', { number })}</DialogTitle>
          <DialogDescription>{t('recordIntro')}</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            start(async () => {
              const r = await recordPaymentAction({
                invoiceId,
                amountRupees: fd.get('amount'),
                method: fd.get('method'),
                utr: fd.get('utr'),
                paidOn: fd.get('paidOn'),
              });
              if (!r.ok) return void toast.error(t(r.error === 'conflict' ? 'utrUsed' : 'failed'));
              toast.success(t('recorded'));
              setOpen(false);
              router.refresh();
            })
          }
        >
          <Label className="flex flex-col items-start gap-1">
            {t('utr')}
            <Input name="utr" required className="font-mono uppercase" />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('method')}
            <select
              name="method"
              defaultValue="bank"
              className="min-h-11 w-full rounded-lg border border-input bg-card px-2 font-normal"
            >
              {['upi', 'bank', 'cheque', 'other'].map((m) => (
                <option key={m} value={m}>
                  {m.toUpperCase()}
                </option>
              ))}
            </select>
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('amount')}
            <Input name="amount" type="number" step="0.01" defaultValue={dueRupees} required />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('paidOn')}
            <Input name="paidOn" type="date" max={today} defaultValue={today} required />
          </Label>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {t('record')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
