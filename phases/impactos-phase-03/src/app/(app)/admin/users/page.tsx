import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { publicEnv } from '@/config/env';
import { requirePermission, getPermissions } from '@/lib/authz/can';
import { hasPermission } from '@/lib/authz/permissions';
import { requireUser } from '@/lib/auth/user';
import { formatDate } from '@/lib/i18n/format';
import { listAssignableRoles, listInvitations, listMembers } from '@/features/admin-users/queries';
import { MembersTable } from '@/features/admin-users/components/MembersTable';
import { InviteDialog } from '@/features/admin-users/components/InviteDialog';
import { UsernameAccountDialog } from '@/features/admin-users/components/UsernameAccountDialog';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('admin.users'))('title') };
}

export default async function UsersPage() {
  const user = await requireUser('/admin/users');
  const active = await requirePermission('admin.users.view');
  const orgId = active.organization.id;
  const perms = await getPermissions(orgId);
  const canManage = hasPermission(perms, 'admin.users.manage');
  const [members, invitations, roles, t, locale] = await Promise.all([
    listMembers(orgId),
    listInvitations(orgId),
    listAssignableRoles(orgId, perms.includes('*')),
    getTranslations('admin'),
    getLocale(),
  ]);
  const dateFmt = Object.fromEntries(members.map((m) => [m.id, formatDate(m.joinedAt, locale === 'hi' ? 'hi' : 'en')]));
  const loginUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/login`;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">{t('crumb')}</p>
          <h1 className="text-2xl font-bold">{t('users.title')}</h1>
          <p className="text-muted-foreground">{t('users.intro')}</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <UsernameAccountDialog roles={roles} loginUrl={loginUrl} />
            <InviteDialog roles={roles} />
          </div>
        )}
      </div>
      <MembersTable
        members={members}
        invitations={invitations}
        roles={roles}
        canManage={canManage}
        meId={user.id}
        loginUrl={loginUrl}
        dateFmt={dateFmt}
      />
    </>
  );
}
