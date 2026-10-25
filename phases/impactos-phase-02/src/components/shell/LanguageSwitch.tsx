'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_COOKIE, LOCALES, type Locale } from '@/lib/i18n/config';
import { cn } from '@/lib/utils';

const SHORT: Record<Locale, string> = { en: 'EN', hi: 'हि' };

function saveLocale(locale: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=31536000; samesite=lax`;
}

/** English / Hindi switch. Saves the choice in a cookie (and in the profile from phase 2), then re-renders. */
export function LanguageSwitch({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const locale = useLocale() as Locale;
  const t = useTranslations('common.shell');
  const router = useRouter();
  const [pending, start] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    saveLocale(next);
    start(() => router.refresh());
  }

  return (
    <div role="group" aria-label={t('language')} aria-busy={pending} className={cn('flex overflow-hidden rounded-lg border', tone === 'dark' ? 'border-[#3B5875]' : 'border-border', className)}>
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={l === locale}
          onClick={() => choose(l)}
          className={cn(
            'min-h-10 px-3 text-sm',
            l === locale
              ? tone === 'dark' ? 'bg-white font-semibold text-navy' : 'bg-primary font-semibold text-primary-foreground'
              : tone === 'dark' ? 'bg-transparent text-white' : 'bg-card text-foreground',
          )}
        >
          {SHORT[l]}
          <span className="sr-only">{l === 'en' ? ' English' : ' हिन्दी'}</span>
        </button>
      ))}
    </div>
  );
}
