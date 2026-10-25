'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { RightPanel } from './RightPanel';
import { RightPanelProvider } from './RightPanelContext';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

/**
 * Three-panel shell: Sidebar · content · RightPanel. Used by the (app) and (platform) layouts from phase 2.
 * On phones the sidebar becomes a sheet opened from the top bar.
 */
export function AppShell({
  children, orgName, sidebarFooter, topStart, topSearch, topEnd, topNotice, variant = 'workspace',
}: {
  children: React.ReactNode; orgName?: string; sidebarFooter?: React.ReactNode; topStart?: React.ReactNode; topSearch?: React.ReactNode; topEnd?: React.ReactNode; topNotice?: React.ReactNode; variant?: 'workspace' | 'console';
}) {
  const t = useTranslations('common.shell');
  const [menuOpen, setMenuOpen] = useState(false);
  const path = usePathname();
  // Close the phone menu after navigating.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMenuOpen(false), [path]);

  const sidebar = <Sidebar orgName={orgName} footer={sidebarFooter} variant={variant} />;
  return (
    <RightPanelProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-card focus:px-4 focus:py-2">
        {t('skipToContent')}
      </a>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 md:block">{sidebar}</aside>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" closeLabel={t('closeMenu')} className="w-[280px] border-0 p-0">
            <SheetTitle className="sr-only">{t('mainNav')}</SheetTitle>
            {sidebar}
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setMenuOpen(true)} start={topStart} search={topSearch} end={topEnd} notice={topNotice} />
          <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 p-4 outline-none md:p-6">
            {children}
          </main>
        </div>
      </div>
      <RightPanel />
    </RightPanelProvider>
  );
}
