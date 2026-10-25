import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import type { Database } from '@/lib/supabase/database.types';

export type SettingRow = Database['public']['Tables']['field_settings']['Row'];
export type CustomRow = Database['public']['Tables']['custom_field_definitions']['Row'];

/** Raw settings and custom definitions for the editor (the client merges them for the live preview). */
export async function fieldConfig(
  orgId: string,
  entity: string,
): Promise<{ settings: SettingRow[]; customs: CustomRow[] }> {
  const supabase = await supabaseServer();
  const [{ data: settings }, { data: customs }] = await Promise.all([
    supabase.from('field_settings').select('*').eq('organization_id', orgId).eq('entity', entity),
    supabase
      .from('custom_field_definitions')
      .select('*')
      .eq('organization_id', orgId)
      .eq('entity', entity)
      .is('archived_at', null)
      .order('sort_order'),
  ]);
  return { settings: settings ?? [], customs: customs ?? [] };
}

/** A few real rows for the live preview (people: names, sign-in, joined date and custom values). */
export async function previewRows(orgId: string, entity: string): Promise<Record<string, unknown>[]> {
  if (entity !== 'members') return [];
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('organization_members')
    .select(
      'kind, status, joined_at, custom_fields, profile:profiles!organization_members_profile_fkey(full_name, email), member_roles(role:roles(name))',
    )
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .limit(4);
  return (data ?? []).map((m) => ({
    name: m.profile?.full_name ?? m.profile?.email ?? '—',
    email: m.kind === 'email' ? m.profile?.email : null,
    kind: m.kind,
    status: m.status,
    joined_at: m.joined_at.slice(0, 10),
    roles: m.member_roles
      .map((r) => r.role?.name)
      .filter(Boolean)
      .join(', '),
    positions: '',
    ...(m.custom_fields as Record<string, unknown>),
  }));
}
