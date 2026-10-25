import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { getPermissions, requirePermission } from '@/lib/authz/can';
import { hasPermission } from '@/lib/authz/permissions';
import { requireUser } from '@/lib/auth/user';
import { getRole, listPermissionCatalogue, listRoles } from '@/features/roles/queries';
import { RoleEditor } from '@/features/roles/components/RoleEditor';
import { CloneRoleDialog } from '@/features/roles/components/RolesList';
import { deleteRoleAction } from '@/features/roles/actions';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('admin.roles'))('title') };
}

export default async function RolePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  await requireUser(`/admin/roles/${id}`);
  const active = await requirePermission('admin.roles.view');
  const orgId = active.organization.id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [role, catalogue, perms, roles, t] = await Promise.all([
    getRole(orgId, id),
    listPermissionCatalogue(),
    getPermissions(orgId),
    listRoles(orgId),
    getTranslations('admin'),
  ]);
  if (!role) notFound();
  const canManage = hasPermission(perms, 'admin.roles.manage');
  const error = (await searchParams).error;
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav aria-label={t('breadcrumb')} className="text-[13px] text-muted-foreground">
            {t('crumb')} /{' '}
            <Link href="/admin/roles" className="text-muted-foreground">
              {t('roles.title')}
            </Link>
          </nav>
          <h1 className="text-2xl font-bold">{role.name}</h1>
          <p className="text-muted-foreground">{t('roles.heldBy', { n: role.members })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && !role.grantsAll && <CloneRoleDialog roles={roles} defaultSource={role.id} />}
          {canManage && !role.isSystem && (
            <form action={deleteRoleAction}>
              <input type="hidden" name="roleId" value={role.id} />
              <Button type="submit" variant="ghost" disabled={role.members > 0}>
                {t('roles.delete')}
              </Button>
            </form>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad-fg">
          {t(`errors.${error}`)}
        </p>
      )}
      <RoleEditor role={role} catalogue={catalogue} canManage={canManage} />
    </>
  );
}
