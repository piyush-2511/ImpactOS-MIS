'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { supabaseBrowser } from '@/lib/supabase/browser';
import { Field, FormError } from './Field';

/** TOTP enrolment: scan the QR in an authenticator app, then confirm with a code. */
export function MfaEnroll({ next }: { next: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [factor, setFactor] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [error, setError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = supabaseBrowser();
      // Remove half-finished enrolments so the user can start again.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of list?.all ?? []) if (f.status === 'unverified') await supabase.auth.mfa.unenroll({ factorId: f.id });
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `ImpactOS ${new Date().toISOString().slice(0, 10)}` });
      if (cancelled) return;
      if (error || !data) setError('mfaEnrollFailed');
      else setFactor({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
    return () => { cancelled = true; };
  }, []);

  async function verify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!factor) return;
    setPending(true);
    setCodeError(undefined);
    const code = String(new FormData(e.currentTarget).get('code') ?? '').trim();
    const { error } = await supabaseBrowser().auth.mfa.challengeAndVerify({ factorId: factor.id, code });
    if (error) {
      setCodeError('codeWrong');
      setPending(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>{t('mfa.step1')}</li>
        <li>{t('mfa.step2')}</li>
        <li>{t('mfa.step3')}</li>
      </ol>
      <FormError code={error} />
      {factor ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={factor.qr} alt={t('mfa.qrAlt')} width={200} height={200} className="self-center rounded-lg bg-white p-2" />
          <details className="text-sm">
            <summary className="cursor-pointer">{t('mfa.cantScan')}</summary>
            <p className="mt-2 break-all font-mono">{factor.secret}</p>
          </details>
          <form onSubmit={verify} className="flex flex-col gap-4" noValidate>
            <Field name="code" label={t('fields.code')} inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="font-mono text-xl tracking-[0.4em]" error={codeError} required />
            <Button type="submit" disabled={pending}>{t('actions.verify')}</Button>
          </form>
        </>
      ) : (
        !error && <p className="text-sm text-muted-foreground" role="status">{t('mfa.preparing')}</p>
      )}
    </div>
  );
}
