'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  BuildingIcon,
  CalendarCheckIcon,
  ChevronRightIcon,
  HeartHandshakeIcon,
  HouseIcon,
  IdCardIcon,
  ImageIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SquareCheckIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from 'lucide-react';
import { builtNav, type ModuleDef } from '@/config/modules';
import { usePermissions } from '@/hooks/useCan';
import { hasPermission } from '@/lib/authz/permissions';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  house: HouseIcon,
  users: UsersIcon,
  image: ImageIcon,
  megaphone: MegaphoneIcon,
  'heart-handshake': HeartHandshakeIcon,
  'id-card': IdCardIcon,
  building: BuildingIcon,
  'shield-check': ShieldCheckIcon,
  'calendar-check': CalendarCheckIcon,
  'square-check': SquareCheckIcon,
  'sliders-horizontal': SlidersHorizontalIcon,
  wallet: WalletIcon,
};

const isIn = (path: string, href: string) => path === href || (href !== '/' && path.startsWith(href + '/'));

/**
 * Module navigation. Shows only pages marked `built` in src/config/modules.ts (hard rule 2) that the user has the
 * permission for. Hiding is a convenience: pages and actions check permissions on the server too.
 */
export function Sidebar({
  orgName,
  footer,
  variant = 'workspace',
}: {
  orgName?: string;
  footer?: React.ReactNode;
  variant?: 'workspace' | 'console';
}) {
  const t = useTranslations('common');
  const path = usePathname();
  const permissions = usePermissions();
  const allowed = (perm?: string) => !perm || hasPermission(permissions, perm);
  const nav = builtNav()
    .map((m) =>
      m.pages
        ? {
            ...m,
            pages: m.pages
              .filter((p) => allowed(p.permission))
              .map((p) => ({ ...p, children: p.children?.filter((c) => allowed(c.permission)) })),
          }
        : m,
    )
    .filter((m) => !m.pages || m.pages.length > 0);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const moduleActive = (m: ModuleDef) => (m.href ? isIn(path, m.href) : !!m.pages?.some((p) => isIn(path, p.href)));

  return (
    <nav
      aria-label={t('shell.mainNav')}
      className={cn(
        'flex h-full flex-col gap-0.5 overflow-y-auto px-3 py-4 text-sidebar-foreground',
        variant === 'console' ? 'bg-console-sidebar' : 'bg-sidebar',
      )}
    >
      <div className="flex items-center gap-2.5 px-2.5 pb-4">
        <span className="grid size-8 place-items-center rounded-lg bg-green font-bold text-navy" aria-hidden>
          i
        </span>
        <span>
          <span className="block text-lg font-bold leading-tight">ImpactOS</span>
          {orgName && <span className="block text-[11px] text-sidebar-muted">{orgName}</span>}
        </span>
      </div>
      {nav.length === 0 && <p className="px-2.5 text-sm text-sidebar-muted">{t('shell.noModulesYet')}</p>}
      {nav.map((m) => {
        const Icon = ICONS[m.icon] ?? HouseIcon;
        const active = moduleActive(m);
        if (!m.pages) {
          return (
            <Link
              key={m.id}
              href={m.href ?? '/'}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-10 items-center gap-3 rounded-lg px-2.5 text-sm text-sidebar-foreground no-underline hover:bg-white/5',
                active && 'bg-sidebar-accent font-semibold text-white shadow-[inset_3px_0_0_var(--green)]',
                m.soon && 'text-sidebar-muted',
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              <span className="flex-1">{t(m.labelKey)}</span>
              {m.soon && (
                <span className="rounded-full bg-sidebar-accent px-2 text-[11px] text-[#C9D6E3]">
                  {t('shell.soon')}
                </span>
              )}
            </Link>
          );
        }
        const expanded = open[m.id] ?? active;
        return (
          <div key={m.id}>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setOpen((s) => ({ ...s, [m.id]: !expanded }))}
              className={cn(
                'flex min-h-10 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm hover:bg-white/5',
                active && 'bg-sidebar-accent font-semibold text-white shadow-[inset_3px_0_0_var(--green)]',
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              <span className="flex-1">{t(m.labelKey)}</span>
              <ChevronRightIcon
                className={cn('size-3.5 opacity-70 transition-transform', expanded && 'rotate-90')}
                aria-hidden
              />
            </button>
            {expanded && (
              <div className="my-1 ml-7 flex flex-col border-l border-white/10">
                {m.pages.map((p) => {
                  const here = isIn(path, p.href);
                  return (
                    <div key={p.id}>
                      <Link
                        href={p.href}
                        aria-current={path === p.href ? 'page' : undefined}
                        className={cn(
                          'flex min-h-9 items-center rounded-r-md px-3 text-[13.5px] text-sidebar-muted no-underline hover:bg-white/5 hover:text-white',
                          path === p.href && 'bg-white/10 font-semibold text-white',
                        )}
                      >
                        {t(p.labelKey)}
                      </Link>
                      {here &&
                        p.children?.map((c) => (
                          <Link
                            key={c.id}
                            href={c.href}
                            aria-current={path === c.href ? 'page' : undefined}
                            className={cn(
                              'flex min-h-8 items-center pl-6 pr-3 text-[13px] text-sidebar-muted no-underline hover:text-white',
                              path === c.href && 'font-semibold text-white',
                            )}
                          >
                            {t(c.labelKey)}
                          </Link>
                        ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {footer && <div className="mt-auto px-2.5 pt-4 text-xs text-sidebar-muted">{footer}</div>}
    </nav>
  );
}
