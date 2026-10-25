'use client';

import { useActionState, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { resendCodeAction, verifyCodeAction } from '../actions';
import type { ActionState } from '../schema';
import { Field, FormError } from './Field';

const RESEND_AFTER = 60;

export function VerifyCodeForm({ email, next }: { email: string; next?: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<ActionState, FormData>(verifyCodeAction, {});
  const [resend, resendAction, resending] = useActionState<ActionState, FormData>(resendCodeAction, {});
  const [wait, setWait] = useState(RESEND_AFTER);
  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);
  // Restart the countdown after a successful resend.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { if (resend.ok) setWait(RESEND_AFTER); }, [resend]);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="next" value={next ?? ''} />
        <FormError code={state.error} />
        <Field name="code" label={t('fields.code')} inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="font-mono text-xl tracking-[0.4em]" error={state.fieldErrors?.code} required autoFocus />
        <Button type="submit" disabled={pending}>
          {pending ? t('actions.verifying') : t('actions.verify')}
        </Button>
      </form>
      <form action={resendAction}>
        <input type="hidden" name="email" value={email} />
        <Button type="submit" variant="ghost" className="w-full" disabled={wait > 0 || resending}>
          {wait > 0 ? t('verify.resendIn', { seconds: wait }) : t('actions.resend')}
        </Button>
        {resend.info && <p role="status" className="text-center text-sm text-ok-fg">{t(`info.${resend.info}`)}</p>}
        <FormError code={resend.error} />
      </form>
    </div>
  );
}
