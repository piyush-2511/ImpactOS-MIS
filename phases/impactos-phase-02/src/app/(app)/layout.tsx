import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { AppShell } from '@/components/shell/AppShell';
import { OrgSwitcher } from '@/components/shell/OrgSwitcher';
import { UserMenu } from '@/components/shell/UserMenu';
import { getProfile, requireUser } from '@/lib/auth/user';
import { requireAal2, roleNeedsMfa } from '@/lib/auth/aal';
import { getActiveOrg, listMyOrgs } from '@/lib/org/active-org';

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

  const orgs = await listMyOrgs();
  const t = await getTranslations('account');
  const name = profile?.full_name || user.email?.split('@')[0] || '—';
  const isUsername = active.kind === 'username';
  return (
    <AppShell
      orgName={active.organization.name}
      sidebarFooter={t('trialNote')}
      topStart={<OrgSwitcher active={active.organization} orgs={orgs.map((m) => m.organization)} canCreate={!isUsername} />}
      topEnd={<UserMenu name={name} detail={isUsername ? t(`roles.${active.role}`) : (user.email ?? '')} />}
    >
      {children}
    </AppShell>
  );
}
