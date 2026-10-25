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
import { creditNoteAction } from '../actions';

export function CreditNoteDialog({
  orgId,
  invoiceId,
  number,
}: {
  orgId: string;
  invoiceId?: string;
  number?: string | null;
}) {
  const t = useTranslations('console.billing');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          {t('credit')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('creditTitle')}</DialogTitle>
          <DialogDescription>{t('creditIntro', { number: number ?? '—' })}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          action={(fd) =>
            start(async () => {
              const r = await creditNoteAction({
                orgId,
                invoiceId: invoiceId ?? '',
                amountRupees: fd.get('amount'),
                reason: fd.get('reason'),
              });
              if (!r.ok) return void toast.error(t('failed'));
              toast.success(t('creditIssued', { number: r.data.number ?? '' }));
              setOpen(false);
              router.refresh();
            })
          }
        >
          <Label className="flex flex-col items-start gap-1">
            {t('amount')}
            <Input name="amount" type="number" step="0.01" min="1" required />
          </Label>
          <Label className="flex flex-col items-start gap-1">
            {t('reason')}
            <Input name="reason" required minLength={5} maxLength={500} />
          </Label>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t('issueCredit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
