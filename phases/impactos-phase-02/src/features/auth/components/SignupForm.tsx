'use client';

import Script from 'next/script';
import { useActionState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LOCALE_LABELS } from '@/lib/i18n/config';
import { Label } from '@/components/ui/label';
import { signUpAction } from '../actions';
import type { ActionState } from '../schema';
import { Field, FormError } from './Field';
import { GoogleButton } from './GoogleButton';

export function SignupForm({ turnstileSiteKey }: { turnstileSiteKey?: string }) {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [state, action, pending] = useActionState<ActionState, FormData>(signUpAction, {});
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormError code={state.error} />
      <Field name="fullName" label={t('fields.fullName')} autoComplete="name" defaultValue={state.values?.fullName} error={state.fieldErrors?.fullName} required />
      <Field name="email" type="email" label={t('fields.workEmail')} autoComplete="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} required />
      <Field name="password" type="password" label={t('fields.newPassword')} hint={t('fields.passwordHint')} autoComplete="new-password" error={state.fieldErrors?.password} required />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-locale">{t('fields.language')}</Label>
        <select id="f-locale" name="locale" defaultValue={locale} className="min-h-11 rounded-lg border border-input bg-card px-3">
          <option value="en">{LOCALE_LABELS.en}</option>
          <option value="hi">{LOCALE_LABELS.hi}</option>
        </select>
      </div>
      {turnstileSiteKey && (
        <>
          <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
          <div className="cf-turnstile" data-sitekey={turnstileSiteKey} data-language={locale} />
        </>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? t('actions.creating') : t('actions.createAccount')}
      </Button>
      <GoogleButton next="/setup-org" />
      <p className="text-xs text-muted-foreground">{t('signup.terms')}</p>
    </form>
  );
}
