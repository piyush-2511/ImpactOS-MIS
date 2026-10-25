'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/patterns/ConfirmDialog';
import { runInvoicesAction } from '../actions';

export function InvoiceRunPanel({ due }: { due: number }) {
  const t = useTranslations('console.billing');
  const router = useRouter();
  const [pending] = useTransition();
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <CardTitle>{t('runTitle')}</CardTitle>
        <p className="text-sm text-muted-foreground">{t('runIntro', { n: due })}</p>
      </div>
      <ConfirmDialog
        trigger={<Button disabled={pending || due === 0}>{t('runNow')}</Button>}
        title={t('runConfirmTitle', { n: due })}
        description={t('runConfirmBody')}
        confirmLabel={t('runNow')}
        cancelLabel={t('cancel')}
        onConfirm={async () => {
          const r = await runInvoicesAction({ confirm: true });
          if (r.ok) {
            toast.success(t('runDone', { n: r.data.issued }));
            router.refresh();
          } else toast.error(t('failed'));
        }}
      />
    </Card>
  );
}
