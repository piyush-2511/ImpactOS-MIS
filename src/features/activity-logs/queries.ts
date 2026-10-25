import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import type { AuditEventRow } from '@/lib/supabase/database.types';

export type AuditFilters = {
  actor?: string;
  table?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
};
export type AuditRow = AuditEventRow & { actorName: string };
export const AUDIT_PAGE_SIZE = 50;

/** Activity log, newest first, filtered and paged on the server. RLS: admin.audit.view in the organisation. */
export async function listAuditEvents(orgId: string, f: AuditFilters): Promise<{ rows: AuditRow[]; hasMore: boolean }> {
  const supabase = await supabaseServer();
  const page = Math.max(1, f.page ?? 1);
  let q = supabase
    .from('audit_events')
    .select('*')
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .range((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE);
  if (f.actor) q = q.eq('actor_id', f.actor);
  if (f.table) q = q.eq('table_name', f.table);
  if (f.action) q = q.ilike('action', `${f.action}%`);
  if (f.from) q = q.gte('created_at', `${f.from}T00:00:00+05:30`);
  if (f.to) q = q.lte('created_at', `${f.to}T23:59:59+05:30`);
  const { data, error } = await q;
  if (error) throw error;
  const rows = data ?? [];
  const ids = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => !!x))];
  const { data: profiles } = ids.length
    ? await supabase.from('profiles').select('id, full_name, email').in('id', ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email?.split('@')[0] || '—']));
  return {
    rows: rows
      .slice(0, AUDIT_PAGE_SIZE)
      .map((r) => ({ ...r, actorName: r.actor_id ? (names.get(r.actor_id) ?? 'ImpactOS') : 'System' })),
    hasMore: rows.length > AUDIT_PAGE_SIZE,
  };
}

/** People who appear in the log, for the "who" filter. */
export async function listActorsForFilter(orgId: string) {
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('organization_members')
    .select('user_id, profile:profiles!organization_members_profile_fkey(full_name, email)')
    .eq('organization_id', orgId);
  return (data ?? [])
    .map((m) => ({ id: m.user_id, name: m.profile?.full_name || m.profile?.email?.split('@')[0] || '—' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
