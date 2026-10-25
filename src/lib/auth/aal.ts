import 'server-only';
import { redirect } from 'next/navigation';
import type { BaseRole } from '@/lib/supabase/database.types';
import { supabaseServer } from '@/lib/supabase/server';

/** Roles that must use two-step sign-in (TOTP). Platform staff always must. */
export const MFA_REQUIRED_ROLES: readonly BaseRole[] = ['secretary', 'admin', 'finance'];

export async function getAal() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return { current: data?.currentLevel ?? 'aal1', next: data?.nextLevel ?? 'aal1' };
}

/**
 * Ensures the session is AAL2 when required: sends users with a factor to /mfa (challenge) and users without one
 * to /mfa/setup (enrolment), then back to `next`.
 */
export async function requireAal2(next: string): Promise<void> {
  const { current, next: possible } = await getAal();
  if (current === 'aal2') return;
  redirect(`${possible === 'aal2' ? '/mfa' : '/mfa/setup'}?next=${encodeURIComponent(next)}`);
}

export function roleNeedsMfa(role: BaseRole | null | undefined): boolean {
  return !!role && MFA_REQUIRED_ROLES.includes(role);
}
