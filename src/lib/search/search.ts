'use server';

import { getActiveOrg } from '@/lib/org/active-org';
import { getCurrentUser } from '@/lib/auth/user';
import { supabaseServer } from '@/lib/supabase/server';

export type SearchHit = { kind: string; id: string; title: string; subtitle: string | null; href: string };

/** Topbar search across what the user is allowed to see (RLS applies inside global_search). */
export async function searchAction(q: string): Promise<SearchHit[]> {
  const term = String(q ?? '')
    .trim()
    .slice(0, 80);
  if (term.length < 2) return [];
  const [user, active] = await Promise.all([getCurrentUser(), getActiveOrg()]);
  if (!user || !active) return [];
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc('global_search', { p_org: active.organization.id, p_q: term, p_limit: 20 });
  return (data ?? []).map(({ kind, id, title, subtitle, href }) => ({ kind, id, title, subtitle, href }));
}
