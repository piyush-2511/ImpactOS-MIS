'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Field, FormError } from './Field';

/** Field staff, interns and volunteers: organisation code + username + password (no email). */
export function UsernameLoginForm({ orgCode, next }: { orgCode?: string; next?: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(undefined);
    setFieldErrors({});
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch('/api/auth/username-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orgCode: fd.get('orgCode'), username: fd.get('username'), password: fd.get('password'), next }),
      });
      const json = (await res.json()) as { redirect?: string; error?: string; fieldErrors?: Record<string, string> };
      if (json.redirect) {
        router.replace(json.redirect);
        router.refresh();
        return;
      }
      setError(json.error);
      setFieldErrors(json.fieldErrors ?? {});
    } catch {
      setError('network');
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted-foreground">{t('username.intro')}</p>
      <FormError code={error} />
      {orgCode ? (
        <input type="hidden" name="orgCode" value={orgCode} />
      ) : (
        <Field name="orgCode" label={t('fields.orgCode')} hint={t('fields.orgCodeHint')} autoCapitalize="none" autoCorrect="off" error={fieldErrors.orgCode} required />
      )}
      <Field name="username" label={t('fields.username')} autoComplete="username" autoCapitalize="none" autoCorrect="off" placeholder="sunita.k" error={fieldErrors.username} required />
      <Field name="password" type="password" label={t('fields.password')} autoComplete="current-password" error={fieldErrors.password} required />
      <Button type="submit" disabled={pending}>
        {pending ? t('actions.signingIn') : t('actions.signIn')}
      </Button>
      <p className="rounded-lg bg-secondary px-3 py-2 text-sm">{t('username.forgot')}</p>
    </form>
  );
}
