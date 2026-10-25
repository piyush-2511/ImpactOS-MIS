'use client';

import { MenuIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { LanguageSwitch } from './LanguageSwitch';
import { ThemeToggle } from './ThemeToggle';

/**
 * Top bar. Slots: `start` (org switcher), `search` (global search, P4), `end` (account menu; notifications P4),
 * `notice` (a full-width strip under the bar: support sessions, read-only billing state, console staff label).
 */
export function Topbar({ onMenu, start, search, end, notice }: { onMenu?: () => void; start?: React.ReactNode; search?: React.ReactNode; end?: React.ReactNode; notice?: React.ReactNode }) {
  const t = useTranslations('common.shell');
  return (
    <div className="sticky top-[env(safe-area-inset-top,0px)] z-20">
    <header className="flex flex-wrap items-center gap-2.5 border-b border-border bg-card px-4 py-3 md:px-6">
      {onMenu && (
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label={t('openMenu')}>
          <MenuIcon className="size-5" aria-hidden />
        </Button>
      )}
      {start}
      <div className="min-w-0 flex-1">{search}</div>
      <LanguageSwitch />
      <ThemeToggle />
      {end}
    </header>
    {notice && (
      <div role="status" className="border-b border-border bg-info-bg px-4 py-2 text-sm text-info-fg md:px-6">
        {notice}
      </div>
    )}
    </div>
  );
}
