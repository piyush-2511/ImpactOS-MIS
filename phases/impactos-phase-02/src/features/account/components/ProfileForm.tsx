'use client';

import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LOCALE_LABELS } from '@/lib/i18n/config';
import { Label } from '@/components/ui/label';
import { Field, FormError } from '@/features/auth/components/Field';
import type { ActionState } from '@/features/auth/schema';
import { updateProfileAction } from '../actions';

export function ProfileForm({ fullName, email, locale, isUsernameAccount }: { fullName: string; email: string; locale: 'en' | 'hi'; isUsernameAccount: boolean }) {
  const t = useTranslations('account');
  const [state, action, pending] = useActionState<ActionState, FormData>(updateProfileAction, {});
  return (
    <form action={action} className="flex max-w-lg flex-col gap-4" noValidate>
      <FormError code={state.error} />
      <Field name="fullName" label={t('profile.name')} defaultValue={fullName} autoComplete="name" error={state.fieldErrors?.fullName} required />
      {!isUsernameAccount && <Field name="email" label={t('profile.email')} value={email} readOnly />}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="f-locale">{t('profile.language')}</Label>
        <select id="f-locale" name="locale" defaultValue={locale} className="min-h-11 rounded-lg border border-input bg-card px-3">
          <option value="en">{LOCALE_LABELS.en}</option>
          <option value="hi">{LOCALE_LABELS.hi}</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>{t('profile.save')}</Button>
        {state.ok && <span role="status" className="text-sm text-ok-fg">{t('profile.saved')}</span>}
      </div>
    </form>
  );
}
