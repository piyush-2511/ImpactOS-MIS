'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { forgotPasswordAction } from '../actions';
import type { ActionState } from '../schema';
import { Field } from './Field';

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<ActionState, FormData>(forgotPasswordAction, {});
  if (state.ok) return <p role="status" className="rounded-lg bg-ok-bg px-3 py-2 text-sm text-ok-fg">{t('info.resetSent')}</p>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <Field name="email" type="email" autoComplete="email" label={t('fields.email')} error={state.fieldErrors?.email} required />
      <Button type="submit" disabled={pending}>{t('actions.sendResetLink')}</Button>
    </form>
  );
}
