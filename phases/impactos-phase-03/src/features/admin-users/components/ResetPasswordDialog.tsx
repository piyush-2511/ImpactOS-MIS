'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { KeyRoundIcon } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { resetUsernamePasswordAction } from '../actions';
import { PrintableSlip, type SlipData } from './PrintableSlip';

/** HR password reset for username accounts: confirm, then show the new one-time password on a slip. */
export function ResetPasswordDialog({
  memberId,
  name,
  loginUrl,
}: {
  memberId: string;
  name: string;
  loginUrl: string;
}) {
  const t = useTranslations('admin');
  const [pending, start] = useTransition();
  const [slip, setSlip] = useState<SlipData | null>(null);
  const [error, setError] = useState<string>();

  function reset() {
    start(async () => {
      const res = await resetUsernamePasswordAction({ memberId });
      if (!res.ok) return void setError(res.error);
      setSlip({ ...res.data, fullName: res.data.fullName || name, loginUrl });
    });
  }

  return (
    <>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={pending}>
            <KeyRoundIcon aria-hidden /> {t('users.resetPassword')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('users.resetTitle', { name })}</AlertDialogTitle>
            <AlertDialogDescription>{t('users.resetIntro')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={reset}>{t('users.resetConfirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
      <Dialog open={!!slip} onOpenChange={(o) => !o && setSlip(null)}>
        <DialogContent closeLabel={t('close')}>
          <DialogHeader>
            <DialogTitle>{t('users.slipReady')}</DialogTitle>
            <DialogDescription>{t('users.slipIntro')}</DialogDescription>
          </DialogHeader>
          {slip && <PrintableSlip data={slip} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
