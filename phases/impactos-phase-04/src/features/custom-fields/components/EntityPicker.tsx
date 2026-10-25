'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

/** Choose which page's fields to configure. More pages appear as modules are switched on. */
export function EntityPicker({ entities, current }: { entities: { key: string; label: string }[]; current: string }) {
  const t = useTranslations('engine.fields');
  return (
    <nav aria-label={t('pages')} className="flex flex-wrap items-center gap-2 rounded-xl bg-card p-3 shadow-sm">
      {entities.map((e) => (
        <Link
          key={e.key}
          href={`/admin/custom-fields?e=${e.key}`}
          aria-current={e.key === current ? 'page' : undefined}
          className={cn(
            'inline-flex min-h-9 items-center rounded-full border border-border px-4 text-sm text-foreground no-underline',
            e.key === current && 'border-foreground bg-accent font-semibold',
          )}
        >
          {e.label}
        </Link>
      ))}
      <span className="ml-auto text-sm text-muted-foreground">{t('morePages')}</span>
    </nav>
  );
}
