import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { serverEnv } from '@/config/env';
import type { BaseRole, Organization } from '@/lib/supabase/database.types';
import { supabaseServer } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/user';
import { ORG_COOKIE, ORG_COOKIE_MAX_AGE, signOrgId, verifyOrgCookie } from './cookie';

export type Membership = { organization: Pick<Organization, 'id' | 'name' | 'slug' | 'locale' | 'status' | 'fcra_registered'>; role: BaseRole; kind: 'email' | 'username' };

function secret() {
  return serverEnv().ORG_COOKIE_SECRET ?? 'dev-only-org-cookie-secret-change-me-please';
}

/** Active memberships of the signed-in user, ordered by name. RLS returns only the user's own rows. */
export const listMyOrgs = cache(async (): Promise<Membership[]> => {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await supabaseServer();
  const { data, error } = await supabase
    .from('organization_members')
    .select('base_role, kind, organization:organizations!inner(id, name, slug, locale, status, fcra_registered)')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (error) throw error;
  return (data ?? [])
    .filter((m) => m.organization.status === 'active')
    .map((m) => ({ organization: m.organization, role: m.base_role, kind: m.kind }))
    .sort((a, b) => a.organization.name.localeCompare(b.organization.name));
});

/**
 * The organisation the user is working in: signed cookie → profile.last_org_id → first membership.
 * Membership is re-checked on every request; returns null when the user belongs to no active organisation.
 */
export const getActiveOrg = cache(async (): Promise<Membership | null> => {
  const orgs = await listMyOrgs();
  if (!orgs.length) return null;
  const fromCookie = await verifyOrgCookie((await cookies()).get(ORG_COOKIE)?.value, secret());
  const byId = (id: string | null | undefined) => (id ? orgs.find((m) => m.organization.id === id) : undefined);
  if (fromCookie && byId(fromCookie)) return byId(fromCookie)!;
  const user = await getCurrentUser();
  const supabase = await supabaseServer();
  const { data: profile } = await supabase.from('profiles').select('last_org_id').eq('id', user!.id).maybeSingle();
  return byId(profile?.last_org_id) ?? orgs[0]!;
});

/** Switch organisation (server actions only): checks membership, sets the signed cookie and profile.last_org_id. */
export async function setActiveOrg(orgId: string): Promise<boolean> {
  const orgs = await listMyOrgs();
  if (!orgs.some((m) => m.organization.id === orgId)) return false;
  const store = await cookies();
  store.set(ORG_COOKIE, await signOrgId(orgId, secret()), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: ORG_COOKIE_MAX_AGE,
  });
  const user = await getCurrentUser();
  const supabase = await supabaseServer();
  await supabase.from('profiles').update({ last_org_id: orgId }).eq('id', user!.id);
  return true;
}
