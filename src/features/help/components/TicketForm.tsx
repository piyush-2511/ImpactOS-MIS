'use client';

import { usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { createTicketAction } from '../actions';

export function TicketForm({ onDone }: { onDone: () => void }) {
  const t = useTranslations('billing.help');
  const path = usePathname();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  if (sent)
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-lg bg-ok-bg px-3 py-2 text-sm text-ok-fg">
          {t('sent')}
        </p>
        <Button onClick={onDone}>{t('close')}</Button>
      </div>
    );
  return (
    <form
      className="flex flex-col gap-3"
      action={(fd) =>
        start(async () => {
          const r = await createTicketAction({ subject: fd.get('subject'), body: fd.get('body'), page: path });
          if (!r.ok) return void setErrors(r.fieldErrors ?? { form: r.error });
          setSent(true);
        })
      }
    >
      {errors.form && (
        <p role="alert" className="text-sm text-destructive">
          {t('failed')}
        </p>
      )}
      <Label className="flex flex-col items-start gap-1">
        {t('subject')}
        <Input name="subject" required maxLength={150} aria-invalid={!!errors.subject} />
      </Label>
      <Label className="flex flex-col items-start gap-1">
        {t('body')}
        <Textarea
          name="body"
          required
          maxLength={4000}
          placeholder={t('bodyPlaceholder')}
          aria-invalid={!!errors.body}
        />
      </Label>
      {(errors.subject || errors.body) && (
        <p role="alert" className="text-sm text-destructive">
          {t('check')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('privacy')}</p>
      <Button type="submit" disabled={pending}>
        {t('send')}
      </Button>
    </form>
  );
}
