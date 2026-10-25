import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getLocale, getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/shell/AppShell';
import { OrgSwitcher } from '@/components/shell/OrgSwitcher';
import { UserMenu } from '@/components/shell/UserMenu';
import { getProfile, requireUser } from '@/lib/auth/user';
import { requireAal2, roleNeedsMfa } from '@/lib/auth/aal';
import { getActiveOrg, listMyOrgs } from '@/lib/org/active-org';
import { getPermissions } from '@/lib/authz/can';
import { PermissionsProvider } from '@/hooks/useCan';
import { GlobalSearch } from '@/features/search/components/GlobalSearch';
import { NotificationBell } from '@/features/notifications/components/NotificationBell';
import { recentNotifications } from '@/features/notifications/queries';
import { formatDate } from '@/lib/i18n/format';
import { AccountBanners } from '@/components/shell/AccountBanners';
import { HelpButton } from '@/features/help/components/HelpButton';
import { getPlanInfo } from '@/lib/billing/limits';
import { hasPermission } from '@/lib/authz/permissions';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * NGO workspace (app.theimpactos.in). Guard order: signed in → forced password change → member of an organisation →
 * two-step sign-in when the role needs it. Every page below can rely on an active organisation.
 */
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get('x-impactos-path') ?? '/';
  const user = await requireUser(path);
  const profile = await getProfile();
  if (profile?.must_change_password) redirect(`/change-password?next=${encodeURIComponent(path)}`);
  const active = await getActiveOrg();
  if (!active) redirect('/setup-org');
  if (roleNeedsMfa(active.role)) await requireAal2(path);

  const [orgs, permissions, notes, locale] = await Promise.all([
    listMyOrgs(),
    getPermissions(active.organization.id),
    recentNotifications(),
    getLocale(),
  ]);
  const when = Object.fromEntries(
    notes.items.map((n) => [n.id, formatDate(n.createdAt, locale === 'hi' ? 'hi' : 'en')]),
  );
  const supabase = await supabaseServer();
  const nowIso = new Date().toISOString();
  const [plan, { data: grant }, { data: news }] = await Promise.all([
    getPlanInfo(active.organization.id),
    supabase
      .from('support_grants')
      .select('expires_at')
      .eq('organization_id', active.organization.id)
      .is('revoked_at', null)
      .gt('expires_at', nowIso)
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('announcements')
      .select('id, title_en, title_hi, body_en, body_hi, tone, plan_key')
      .lte('starts_at', nowIso)
      .gt('ends_at', nowIso)
      .limit(3),
  ]);
  const hi = locale === 'hi';
  const banners = (
    <AccountBanners
      plan={plan}
      canBill={hasPermission(permissions, 'admin.billing.manage')}
      supportUntil={
        grant
          ? new Date(grant.expires_at).toLocaleString(hi ? 'hi-IN' : 'en-IN', {
              timeZone: 'Asia/Kolkata',
              timeStyle: 'short',
              dateStyle: 'medium',
            })
          : null
      }
      announcements={(news ?? [])
        .filter((a) => !a.plan_key || a.plan_key === plan?.planKey)
        .map((a) => ({
          id: a.id,
          title: (hi && a.title_hi) || a.title_en,
          body: (hi && a.body_hi) || a.body_en,
          tone: a.tone,
        }))}
    />
  );
  const t = await getTranslations('account');
  const name = profile?.full_name || user.email?.split('@')[0] || '—';
  const isUsername = active.kind === 'username';
  return (
    <PermissionsProvider permissions={permissions}>
      <AppShell
        orgName={active.organization.name}
        sidebarFooter={t('trialNote')}
        topStart={
          <OrgSwitcher active={active.organization} orgs={orgs.map((m) => m.organization)} canCreate={!isUsername} />
        }
        banners={banners}
        topSearch={<GlobalSearch />}
        topEnd={
          <>
            <HelpButton />
            <NotificationBell items={notes.items} unread={notes.unread} when={when} />
            <UserMenu name={name} detail={isUsername ? t(`roles.${active.role}`) : (user.email ?? '')} />
          </>
        }
      >
        {children}
      </AppShell>
    </PermissionsProvider>
  );
}
