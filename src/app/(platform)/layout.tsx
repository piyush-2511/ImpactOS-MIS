import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/shell/AppShell';
import { ConsoleNav } from '@/components/shell/ConsoleNav';
import { UserMenu } from '@/components/shell/UserMenu';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { recentNotifications } from '@/features/notifications/queries';
import { formatDate } from '@/lib/i18n/format';
import { getProfile } from '@/lib/auth/user';
import { requirePlatformStaff } from '@/lib/platform/staff';

/**
 * Platform console (console.theimpactos.in). The login page renders bare; every other page gets the console shell
 * after the staff guard (host + allowlist + two-step). Pages and actions check again (layouts and pages render in parallel).
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const h = await headers();
  if (h.get('x-impactos-host') !== 'console') notFound();
  const path = (h.get('x-impactos-path') ?? '/console').split('?')[0]!;
  if (path === '/console/login') return <div className="min-h-dvh bg-background">{children}</div>;
  const staff = await requirePlatformStaff(path);
  const [profile, notes, t, locale] = await Promise.all([
    getProfile(),
    recentNotifications(),
    getTranslations('console'),
    getLocale(),
  ]);
  const when = Object.fromEntries(
    notes.items.map((n) => [n.id, formatDate(n.createdAt, locale === 'hi' ? 'hi' : 'en')]),
  );
  return (
    <AppShell
      variant="console"
      sidebar={<ConsoleNav footer={t('signedInAs', { role: t(`roles.${staff.role}`) })} />}
      topEnd={
        <>
          <NotificationBell items={notes.items} unread={notes.unread} when={when} />
          <UserMenu name={profile?.full_name ?? profile?.email ?? 'Staff'} detail={t(`roles.${staff.role}`)} />
        </>
      }
    >
      {children}
    </AppShell>
  );
}
