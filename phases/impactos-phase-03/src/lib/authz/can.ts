import 'server-only';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { supabaseServer } from '@/lib/supabase/server';
import { getActiveOrg } from '@/lib/org/active-org';
import { hasPermission } from './permissions';

/** Permission keys the current user holds in an organisation (['*'] for the Secretary). Cached per request. */
export const getPermissions = cache(async (orgId: string): Promise<string[]> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('my_permissions', { org: orgId });
  if (error) throw error;
  return data ?? [];
});

/** Server check against the active organisation. */
export async function can(perm: string): Promise<boolean> {
  const active = await getActiveOrg();
  if (!active) return false;
  return hasPermission(await getPermissions(active.organization.id), perm);
}

/**
 * Page guard: 404 when the user lacks the permission (pages of other roles stay invisible). Returns the active
 * membership so the page can use it. RLS enforces the same rule in the database.
 */
export async function requirePermission(perm: string) {
  const active = await getActiveOrg();
  if (!active || !hasPermission(await getPermissions(active.organization.id), perm)) notFound();
  return active;
}
