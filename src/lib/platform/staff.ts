import 'server-only';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { serverEnv } from '@/config/env';
import { supabaseServer } from '@/lib/supabase/server';
import { getAal } from '@/lib/auth/aal';
import { getCurrentUser } from '@/lib/auth/user';

export type StaffRole = 'super_admin' | 'support' | 'billing' | 'readonly';

/**
 * Guard for every console page, action and route handler. Requires: console host, signed-in user on the
 * platform_staff allowlist, AAL2 (TOTP), and (optionally) an allowed IP. Anyone else gets a 404.
 */
export async function requirePlatformStaff(next = '/console'): Promise<{ userId: string; role: StaffRole }> {
  const h = await headers();
  if (h.get('x-impactos-host') !== 'console') notFound();
  const allow = serverEnv().CONSOLE_IP_ALLOWLIST?.split(',').map((s) => s.trim()).filter(Boolean);
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (allow?.length && (!ip || !allow.includes(ip))) notFound();

  const user = await getCurrentUser();
  if (!user) redirect(`/console/login?next=${encodeURIComponent(next)}`);
  const supabase = await supabaseServer();
  const { data } = await supabase.from('platform_staff').select('role, active').eq('user_id', user.id).maybeSingle();
  if (!data?.active) notFound();
  const { current, next: possible } = await getAal();
  if (current !== 'aal2') redirect(`${possible === 'aal2' ? '/mfa' : '/mfa/setup'}?next=${encodeURIComponent(next)}`);
  return { userId: user.id, role: data.role };
}
