'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const ITEMS = [
  ['overview', '/console'],
  ['tenants', '/console/tenants'],
  ['plans', '/console/plans'],
  ['billing', '/console/billing'],
  ['support', '/console/support'],
  ['flags', '/console/flags'],
  ['announcements', '/console/announcements'],
  ['audit', '/console/audit'],
] as const;

/** Platform console navigation (darker sidebar so staff always know they are in the console). */
export function ConsoleNav({ footer }: { footer?: React.ReactNode }) {
  const t = useTranslations('console.nav');
  const path = usePathname();
  return (
    <nav
      aria-label={t('label')}
      className="flex h-full flex-col gap-0.5 overflow-y-auto bg-console-sidebar px-3 py-4 text-sidebar-foreground"
    >
      <div className="px-2.5 pb-4">
        <span className="block text-lg font-bold">ImpactOS</span>
        <span className="block text-[11px] tracking-wide text-sidebar-muted">{t('badge')}</span>
      </div>
      {ITEMS.map(([key, href]) => {
        const active = href === '/console' ? path === href : path === href || path.startsWith(`${href}/`);
        return (
          <Link
            key={key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex min-h-10 items-center rounded-lg px-2.5 text-sm text-sidebar-foreground no-underline hover:bg-white/5',
              active && 'bg-sidebar-accent font-semibold text-white shadow-[inset_3px_0_0_var(--green)]',
            )}
          >
            {t(key)}
          </Link>
        );
      })}
      {footer && <div className="mt-auto px-2.5 pt-4 text-xs text-sidebar-muted">{footer}</div>}
    </nav>
  );
}
