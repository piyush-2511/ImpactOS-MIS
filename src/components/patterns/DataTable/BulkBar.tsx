'use client';

import { useTranslations } from 'next-intl';
import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Appears at the bottom of the screen while rows are selected: count, the page's bulk actions, and clear. */
export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations('engine.table');
  if (count === 0) return null;
  return (
    <div
      role="region"
      aria-label={t('bulkActions')}
      className="fixed inset-x-0 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-30 mx-auto flex w-[min(720px,calc(100%-2rem))] flex-wrap items-center gap-3 rounded-xl bg-primary px-4 py-3 text-primary-foreground shadow-xl"
    >
      <span className="font-semibold">{t('selected', { n: count })}</span>
      <div className="flex flex-1 flex-wrap gap-2">{children}</div>
      <Button
        size="sm"
        variant="ghost"
        className="text-primary-foreground hover:bg-white/10"
        onClick={onClear}
        aria-label={t('clearSelection')}
      >
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}
