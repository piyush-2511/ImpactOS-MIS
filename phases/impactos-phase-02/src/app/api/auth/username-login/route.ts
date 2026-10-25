import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';
import { limit } from '@/lib/auth/ratelimit';
import { usernameLoginKey } from '@/lib/auth/username';
import { logAuthEvent, recordSignIn, requestMeta } from '@/lib/auth/events';
import { setActiveOrg } from '@/lib/org/active-org';
import { fieldErrors, usernameSignInSchema } from '@/features/auth/schema';
import { postSignInPath } from '@/features/auth/actions';

/**
 * Username sign-in for people without email. Resolves org code + username to the synthetic auth email with the
 * service role (RLS hides usernames from signed-out users), then signs in normally so the session cookie is set.
 * Same error for unknown org, unknown username or wrong password (no enumeration). 5 tries per 15 minutes.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const parsed = usernameSignInSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ fieldErrors: fieldErrors(parsed.error) }, { status: 400 });
  const { orgCode, username, password, next } = parsed.data;

  const { ip } = await requestMeta();
  const rlUser = await limit('usernameLogin', usernameLoginKey(orgCode, username));
  const rlIp = await limit('login', `ip|${ip ?? 'unknown'}`);
  if (!rlUser.ok || !rlIp.ok) {
    return NextResponse.json({ error: 'rateLimited' }, { status: 429, headers: { 'Retry-After': String(Math.max(rlUser.retryAfter, rlIp.retryAfter)) } });
  }

  const admin = supabaseAdmin();
  const invalid = async () => {
    await logAuthEvent('sign_in_failed');
    return NextResponse.json({ error: 'invalidCredentials' }, { status: 401 });
  };
  const { data: org } = await admin.from('organizations').select('id, status').eq('slug', orgCode).maybeSingle();
  if (!org || org.status !== 'active') return invalid();
  const { data: acct } = await admin.from('username_accounts').select('user_id').eq('organization_id', org.id).eq('username', username).maybeSingle();
  if (!acct) return invalid();
  const { data: member } = await admin.from('organization_members').select('status').eq('organization_id', org.id).eq('user_id', acct.user_id).maybeSingle();
  if (member?.status !== 'active') return invalid();
  const { data: authUser } = await admin.auth.admin.getUserById(acct.user_id);
  const email = authUser.user?.email;
  if (!email) return invalid();

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return invalid();
  await recordSignIn(data.user, 'username_login');
  await setActiveOrg(org.id);
  return NextResponse.json({ redirect: await postSignInPath(next) });
}
