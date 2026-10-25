import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getPermissions, requirePermission } from '@/lib/authz/can';
import { hasPermission } from '@/lib/authz/permissions';
import { requireUser } from '@/lib/auth/user';
import { listActiveMembersForPicker, listPositions } from '@/features/positions/queries';
import { listAssignableRoles } from '@/features/admin-users/queries';
import { PositionsList } from '@/features/positions/components/PositionsList';
import { PositionForm } from '@/features/positions/components/PositionForm';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations('admin.positions'))('title') };
}

export default async function PositionsPage() {
  await requireUser('/admin/positions');
  const active = await requirePermission('admin.positions.view');
  const orgId = active.organization.id;
  const [positions, members, roles, perms, t] = await Promise.all([
    listPositions(orgId),
    listActiveMembersForPicker(orgId),
    listAssignableRoles(orgId, false),
    getPermissions(orgId),
    getTranslations('admin'),
  ]);
  const canManage = hasPermission(perms, 'admin.positions.manage');
  const roleOptions = roles.map((r) => ({ id: r.id, name: r.name }));
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[13px] text-muted-foreground">{t('crumb')}</p>
          <h1 className="text-2xl font-bold">{t('positions.title')}</h1>
          <p className="text-muted-foreground">{t('positions.intro')}</p>
        </div>
        {canManage && (
          <PositionForm
            roles={roleOptions}
            trigger={
              <Button>
                <PlusIcon aria-hidden /> {t('positions.add')}
              </Button>
            }
          />
        )}
      </div>
      <PositionsList positions={positions} roles={roleOptions} members={members} canManage={canManage} today={today} />
    </>
  );
}
