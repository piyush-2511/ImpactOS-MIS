'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { breakGlassAction } from '@/features/console-tenants/actions';

/** Emergency read access (1 hour) without consent: written reason, explicit confirmation, Secretaries told at once. */
export function BreakGlassDialog({ orgId }: { orgId: string }) {
  const t = useTranslations('console.breakGlass');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="destructive">
          {t('open')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('intro')}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          action={(fd) =>
            start(async () => {
              const r = await breakGlassAction({ orgId, reason: fd.get('reason'), confirm });
              if (!r.ok) return void toast.error(t(r.fieldErrors?.reason ? 'reasonShort' : 'failed'));
              toast.success(t('granted'));
              setOpen(false);
              router.refresh();
            })
          }
        >
          <Label className="flex flex-col items-start gap-1">
            {t('reason')}
            <Textarea
              name="reason"
              required
              minLength={20}
              maxLength={500}
              placeholder={t('placeholder')}
              className="font-normal"
            />
          </Label>
          <div className="flex items-start gap-2">
            <Checkbox id="bg-confirm" checked={confirm} onCheckedChange={(v) => setConfirm(v === true)} />
            <Label htmlFor="bg-confirm" className="font-normal">
              {t('confirm')}
            </Label>
          </div>
          <DialogFooter>
            <Button type="submit" variant="destructive" disabled={pending || !confirm}>
              {t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
