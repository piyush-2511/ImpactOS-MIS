'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { changePasswordAction, resetPasswordAction } from '../actions';
import type { ActionState } from '../schema';
import { Field, FormError } from './Field';

/** New password + confirmation. `mode="reset"` after a reset email; `mode="change"` for forced first-login changes. */
export function ChangePasswordForm({ mode = 'change', next }: { mode?: 'change' | 'reset'; next?: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<ActionState, FormData>(mode === 'reset' ? resetPasswordAction : changePasswordAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ''} />
      <FormError code={state.error} />
      <Field name="password" type="password" autoComplete="new-password" label={t('fields.newPassword')} hint={t('fields.passwordHint')} error={state.fieldErrors?.password} required />
      <Field name="confirm" type="password" autoComplete="new-password" label={t('fields.confirmPassword')} error={state.fieldErrors?.confirm} required />
      <Button type="submit" disabled={pending}>
        {pending ? t('actions.saving') : t('actions.savePassword')}
      </Button>
    </form>
  );
}
