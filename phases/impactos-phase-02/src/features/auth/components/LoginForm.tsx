'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { signInAction } from '../actions';
import type { ActionState } from '../schema';
import { Field, FormError } from './Field';
import { GoogleButton } from './GoogleButton';

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState<ActionState, FormData>(signInAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next ?? ''} />
      <FormError code={state.error} />
      <Field name="email" type="email" autoComplete="email" label={t('fields.email')} defaultValue={state.values?.email} error={state.fieldErrors?.email} required />
      <Field name="password" type="password" autoComplete="current-password" label={t('fields.password')} error={state.fieldErrors?.password} required />
      <Button type="submit" disabled={pending}>
        {pending ? t('actions.signingIn') : t('actions.signIn')}
      </Button>
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t('or')}
        <span className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton next={next} />
      <Link href="/forgot-password" className="self-center text-sm">
        {t('actions.forgotPassword')}
      </Link>
    </form>
  );
}
