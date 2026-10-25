'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { consoleSignInAction } from '../actions';
import type { ActionState } from '../schema';
import { Field, FormError } from './Field';

/** ImpactOS staff only: email + password, then the authenticator code (always required). No Google, no sign-up. */
export function ConsoleLoginForm({ next }: { next: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<ActionState, FormData>(consoleSignInAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormError code={state.error} />
      <Field name="email" type="email" autoComplete="username" label={t('fields.workEmail')} defaultValue={state.values?.email} error={state.fieldErrors?.email} required />
      <Field name="password" type="password" autoComplete="current-password" label={t('fields.password')} error={state.fieldErrors?.password} required />
      <Button type="submit" disabled={pending}>{t('console.continue')}</Button>
    </form>
  );
}
