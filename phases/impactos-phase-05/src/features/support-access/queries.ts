import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

export type GrantRow = {
  id: string;
  reason: string;
  breakGlass: boolean;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
};
export type AccessRow = { id: number; view: string; at: string; breakGlass: boolean };

/** Grants (latest 20) and every console view made under them (latest 200), for Admin → Support access. */
export async function supportAccess(orgId: string): Promise<{ grants: GrantRow[]; log: AccessRow[] }> {
  const supabase = await supabaseServer();
  const [{ data: grants }, { data: log }] = await Promise.all([
    supabase
      .from('support_grants')
      .select('*')
      .eq('organization_id', orgId)
      .order('granted_at', { ascending: false })
      .limit(20),
    supabase
      .from('support_access_log')
      .select('id, view, at, grant_id')
      .eq('organization_id', orgId)
      .order('at', { ascending: false })
      .limit(200),
  ]);
  const now = Date.now();
  const rows = (grants ?? []).map((g) => ({
    id: g.id,
    reason: g.reason,
    breakGlass: g.break_glass,
    grantedAt: g.granted_at,
    expiresAt: g.expires_at,
    revokedAt: g.revoked_at,
    active: !g.revoked_at && new Date(g.expires_at).getTime() > now,
  }));
  const bg = new Set(rows.filter((g) => g.breakGlass).map((g) => g.id));
  return {
    grants: rows,
    log: (log ?? []).map((l) => ({ id: l.id, view: l.view, at: l.at, breakGlass: bg.has(l.grant_id) })),
  };
}
