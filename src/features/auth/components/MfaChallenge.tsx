'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Field } from './Field';

/** Second step of sign-in for accounts with an authenticator app. */
export function MfaChallenge({ next }: { next: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    const code = String(new FormData(e.currentTarget).get('code') ?? '').trim();
    const supabase = supabaseBrowser();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const totp = factors?.totp?.find((f) => f.status === 'verified');
    if (!totp) {
      router.replace(`/mfa/setup?next=${encodeURIComponent(next)}`);
      return;
    }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code });
    if (error) {
      setError('codeWrong');
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground">{t('mfa.challengeIntro')}</p>
      <Field name="code" label={t('fields.code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="font-mono text-xl tracking-[0.4em]" error={error} required autoFocus />
      <Button type="submit" disabled={pending}>{pending ? t('actions.verifying') : t('actions.verify')}</Button>
      <p className="text-sm text-muted-foreground">{t('mfa.lostDevice')}</p>
    </form>
  );
}
