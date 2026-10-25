import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/user';

/** Recent sign-in activity for Account → Sessions (the user's own auth events, via RLS). */
export async function recentSignIns(limit = 10) {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await supabaseServer();
  const { data } = await supabase
    .from('auth_events')
    .select('id, event, ip, user_agent, created_at')
    .eq('user_id', user.id)
    .in('event', ['sign_in', 'username_login', 'console_sign_in', 'sign_in_failed', 'password_changed', 'mfa_verified'])
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

/** Verified authenticator apps on the account. */
export async function mfaFactors() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.mfa.listFactors();
  return (data?.totp ?? []).filter((f) => f.status === 'verified').map((f) => ({ id: f.id, name: f.friendly_name ?? 'Authenticator', createdAt: f.created_at }));
}
