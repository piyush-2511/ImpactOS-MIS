'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { acceptInviteAction, inviteSignUpAction, signOutAction } from '../actions';
import type { ActionState } from '../schema';
import { Field, FormError } from './Field';
import { GoogleButton } from './GoogleButton';

type Props = { token: string; org: string; email: string; signedInAs?: string | null };

/** Invitation landing: accept as the signed-in user, or create a password (the emailed link proves the inbox). */
export function InviteAccept({ token, org, email, signedInAs }: Props) {
  const t = useTranslations('auth');
  const [accept, acceptAction, accepting] = useActionState<ActionState, FormData>(acceptInviteAction, {});
  const [create, createAction, creating] = useActionState<ActionState, FormData>(inviteSignUpAction, {});
  const sameEmail = signedInAs && signedInAs.toLowerCase() === email.toLowerCase();

  if (signedInAs && !sameEmail) {
    return (
      <div className="flex flex-col gap-4">
        <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-fg">{t('invite.wrongAccount', { current: signedInAs, email })}</p>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="w-full">{t('actions.signOutAndContinue')}</Button>
        </form>
      </div>
    );
  }
  if (sameEmail) {
    return (
      <form action={acceptAction} className="flex flex-col gap-4">
        <input type="hidden" name="token" value={token} />
        <FormError code={accept.error} />
        <Button type="submit" disabled={accepting}>{t('invite.accept', { org })}</Button>
      </form>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <form action={createAction} className="flex flex-col gap-4" noValidate>
        <input type="hidden" name="token" value={token} />
        <FormError code={create.error} />
        <Field name="email" label={t('fields.email')} value={email} readOnly />
        <Field name="fullName" label={t('fields.fullName')} autoComplete="name" error={create.fieldErrors?.fullName} required />
        <Field name="password" type="password" label={t('fields.newPassword')} hint={t('fields.passwordHint')} autoComplete="new-password" error={create.fieldErrors?.password} required />
        <Button type="submit" disabled={creating}>{t('invite.join', { org })}</Button>
      </form>
      <GoogleButton invite={token} />
      <p className="text-center text-sm">
        {t('invite.haveAccount')} <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>{t('actions.signIn')}</Link>
      </p>
    </div>
  );
}
