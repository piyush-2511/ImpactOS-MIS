import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

export type RoleListRow = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  defaultScope: 'all' | 'assigned' | 'own';
  requiresMfa: boolean;
  grantsAll: boolean;
  members: number;
  permissions: number;
};

export async function listRoles(orgId: string): Promise<RoleListRow[]> {
  const supabase = await supabaseServer();
  const [{ data: roles, error }, { data: counts }] = await Promise.all([
    supabase
      .from('roles')
      .select(
        'id, name, description, is_system, default_scope, requires_mfa, grants_all, role_permissions(permission_key)',
      )
      .or(`is_system.eq.true,organization_id.eq.${orgId}`)
      .order('is_system', { ascending: false })
      .order('name'),
    supabase
      .from('member_roles')
      .select('role_id, member:organization_members!inner(status)')
      .eq('organization_id', orgId)
      .eq('member.status', 'active'),
  ]);
  if (error) throw error;
  const byRole = new Map<string, number>();
  for (const c of counts ?? []) byRole.set(c.role_id, (byRole.get(c.role_id) ?? 0) + 1);
  return (roles ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.is_system,
    defaultScope: r.default_scope,
    requiresMfa: r.requires_mfa,
    grantsAll: r.grants_all,
    members: byRole.get(r.id) ?? 0,
    permissions: r.role_permissions.length,
  }));
}

export type RoleDetail = RoleListRow & { permissionKeys: string[]; organizationId: string | null };

export async function getRole(orgId: string, roleId: string): Promise<RoleDetail | null> {
  const supabase = await supabaseServer();
  const { data: r } = await supabase
    .from('roles')
    .select(
      'id, name, description, is_system, default_scope, requires_mfa, grants_all, organization_id, role_permissions(permission_key)',
    )
    .eq('id', roleId)
    .maybeSingle();
  if (!r || (!r.is_system && r.organization_id !== orgId)) return null;
  const { count } = await supabase
    .from('member_roles')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('role_id', roleId);
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    isSystem: r.is_system,
    defaultScope: r.default_scope,
    requiresMfa: r.requires_mfa,
    grantsAll: r.grants_all,
    members: count ?? 0,
    permissions: r.role_permissions.length,
    permissionKeys: r.role_permissions.map((p) => p.permission_key),
    organizationId: r.organization_id,
  };
}

/** The permission catalogue from the database (later phases add rows). */
export async function listPermissionCatalogue() {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('permissions')
    .select('key, module, description, sensitive')
    .order('module')
    .order('key');
  return data ?? [];
}
