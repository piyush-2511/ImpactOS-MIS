import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

export type PositionRow = {
  id: string;
  name: string;
  description: string | null;
  isCommittee: boolean;
  isSecretary: boolean;
  defaultRole: string | null;
  defaultRoleId: string | null;
  holders: { id: string; memberId: string; name: string; fromDate: string }[];
};

export async function listPositions(orgId: string): Promise<PositionRow[]> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('positions')
    .select(
      'id, name, description, is_committee, is_secretary, default_role_id, role:roles(name), position_holders(id, member_id, from_date, to_date, member:organization_members(profile:profiles!organization_members_profile_fkey(full_name, email)))',
    )
    .eq('organization_id', orgId)
    .order('is_secretary', { ascending: false })
    .order('name');
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isCommittee: p.is_committee,
    isSecretary: p.is_secretary,
    defaultRole: p.role?.name ?? null,
    defaultRoleId: p.default_role_id,
    holders: p.position_holders
      .filter((h) => !h.to_date)
      .map((h) => ({
        id: h.id,
        memberId: h.member_id,
        fromDate: h.from_date,
        name: h.member?.profile?.full_name || h.member?.profile?.email?.split('@')[0] || '—',
      })),
  }));
}

export async function listActiveMembersForPicker(orgId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('organization_members')
    .select('id, profile:profiles!organization_members_profile_fkey(full_name, email)')
    .eq('organization_id', orgId)
    .eq('status', 'active');
  return (data ?? [])
    .map((m) => ({ id: m.id, name: m.profile?.full_name || m.profile?.email?.split('@')[0] || '—' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
