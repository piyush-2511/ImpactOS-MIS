import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

export type MemberRow = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  username: string | null;
  kind: 'email' | 'username';
  status: 'active' | 'deactivated';
  joinedAt: string;
  roles: { id: string; name: string; key: string | null }[];
  positions: string[];
  scopeCount: number;
};
export type InvitationRow = {
  id: string;
  email: string;
  roleName: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
};
export type RoleOption = {
  id: string;
  name: string;
  key: string | null;
  isSystem: boolean;
  description: string | null;
  defaultScope: 'all' | 'assigned' | 'own';
};

/** Everyone in the organisation (active and deactivated), with roles, positions and scope size. RLS limits to members. */
export async function listMembers(orgId: string): Promise<MemberRow[]> {
  const supabase = await supabaseServer();
  const [{ data, error }, { data: usernames }] = await Promise.all([
    supabase
      .from('organization_members')
      .select(
        'id, user_id, kind, status, joined_at, profile:profiles!organization_members_profile_fkey(full_name, email), member_roles(role:roles(id, name, key)), member_scopes(id), position_holders(to_date, position:positions(name))',
      )
      .eq('organization_id', orgId)
      .order('joined_at', { ascending: true }),
    supabase.from('username_accounts').select('user_id, username').eq('organization_id', orgId),
  ]);
  if (error) throw error;
  const byUser = new Map((usernames ?? []).map((u) => [u.user_id, u.username]));
  return (data ?? []).map((m) => {
    const username = byUser.get(m.user_id) ?? null;
    return {
      id: m.id,
      userId: m.user_id,
      name: m.profile?.full_name || username || m.profile?.email?.split('@')[0] || '—',
      email: m.kind === 'username' ? null : (m.profile?.email ?? null),
      username,
      kind: m.kind,
      status: m.status,
      joinedAt: m.joined_at,
      roles: m.member_roles.flatMap((mr) => (mr.role ? [mr.role] : [])),
      positions: m.position_holders.filter((h) => !h.to_date && h.position).map((h) => h.position!.name),
      scopeCount: m.member_scopes.length,
    };
  });
}

/** Pending invitations (not accepted, not revoked). Expired ones are listed so they can be resent. */
export async function listInvitations(orgId: string): Promise<InvitationRow[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('invitations')
    .select('id, email, created_at, expires_at, role_key, role:roles(name)')
    .eq('organization_id', orgId)
    .is('accepted_at', null)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  const now = Date.now();
  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    roleName: i.role?.name ?? i.role_key,
    createdAt: i.created_at,
    expiresAt: i.expires_at,
    expired: new Date(i.expires_at).getTime() < now,
  }));
}

/** Roles that can be given to people: system templates (Secretary only for Secretaries) and the organisation's own roles. */
export async function listAssignableRoles(orgId: string, includeSecretary: boolean): Promise<RoleOption[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('roles')
    .select('id, name, key, is_system, description, default_scope, grants_all, organization_id')
    .or(`is_system.eq.true,organization_id.eq.${orgId}`)
    .order('is_system', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data ?? [])
    .filter((r) => includeSecretary || !(r.grants_all || r.key === 'secretary'))
    .map((r) => ({
      id: r.id,
      name: r.name,
      key: r.key,
      isSystem: r.is_system,
      description: r.description,
      defaultScope: r.default_scope,
    }));
}
