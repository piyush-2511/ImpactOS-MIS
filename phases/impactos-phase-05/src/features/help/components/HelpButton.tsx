'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LifeBuoyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { TicketForm } from './TicketForm';

/** Top-bar help: ask ImpactOS support a question. The ticket records which page the user was on. */
export function HelpButton() {
  const t = useTranslations('billing.help');
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('open')}>
          <LifeBuoyIcon className="size-5" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('intro')}</DialogDescription>
        </DialogHeader>
        <TicketForm onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
