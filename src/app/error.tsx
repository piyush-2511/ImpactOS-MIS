'use client';

import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('common.errors');
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-start gap-3 px-4 py-20">
      <h1 className="text-2xl font-bold">{t('title')}</h1>
      <p className="text-muted-foreground">{t('body')}</p>
      {error.digest && <p className="font-mono text-xs text-muted-foreground">{error.digest}</p>}
      <div className="flex gap-2">
        <Button onClick={reset}>{t('retry')}</Button>
        <Button asChild variant="outline">
          <Link href="/">{t('home')}</Link>
        </Button>
      </div>
    </div>
  );
}
