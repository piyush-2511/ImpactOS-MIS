import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getPermissions, requirePermission } from '@/lib/authz/can';
import { hasPermission } from '@/lib/authz/permissions';
import { requireUser } from '@/lib/auth/user';
import { listRoles } from '@/features/roles/queries';
import { CloneRoleDialog, RolesList } from '@/features/roles/components/RolesList';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('admin.roles'))('title') };
}

export default async function RolesPage() {
  await requireUser('/admin/roles');
  const active = await requirePermission('admin.roles.view');
  const [roles, perms, t] = await Promise.all([
    listRoles(active.organization.id),
    getPermissions(active.organization.id),
    getTranslations('admin'),
  ]);
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">{t('crumb')}</p>
          <h1 className="text-2xl font-bold">{t('roles.title')}</h1>
          <p className="text-muted-foreground">{t('roles.intro')}</p>
        </div>
        {hasPermission(perms, 'admin.roles.manage') && <CloneRoleDialog roles={roles} />}
      </div>
      <RolesList roles={roles} />
    </>
  );
}
