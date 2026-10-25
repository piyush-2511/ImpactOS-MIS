import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** What ImpactOS staff did in the console (newest first). */
export async function listPlatformAudit(filters: { staff?: string; action?: string }) {
  const db = supabaseAdmin();
  let q = db
    .from('platform_audit_events')
    .select('*, org:organizations(name)')
    .order('at', { ascending: false })
    .limit(300);
  if (filters.staff) q = q.eq('staff_user_id', filters.staff);
  if (filters.action) q = q.ilike('action', `${filters.action.replace(/[%_]/g, '')}%`);
  const [{ data }, { data: staff }] = await Promise.all([q, db.from('platform_staff').select('user_id')]);
  // platform_staff references auth.users, not profiles, so names are fetched separately.
  const ids = (staff ?? []).map((s) => s.user_id);
  const { data: profiles } = ids.length
    ? await db.from('profiles').select('id, full_name, email').in('id', ids)
    : { data: [] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name || p.email || p.id.slice(0, 8)]));
  return {
    rows: (data ?? []).map((e) => ({
      id: e.id,
      at: e.at,
      staff: e.staff_user_id ? (names.get(e.staff_user_id) ?? e.staff_user_id.slice(0, 8)) : 'System',
      action: e.action,
      org: e.org?.name ?? null,
      target: e.target,
      details: e.details,
    })),
    staff: [...names.entries()].map(([id, name]) => ({ id, name })),
  };
}
