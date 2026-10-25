import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { safeNext } from '@/lib/auth/user';
import { hashInviteToken } from '@/lib/auth/invites';
import { recordSignIn } from '@/lib/auth/events';
import { setActiveOrg } from '@/lib/org/active-org';
import { postSignInPath } from '@/features/auth/actions';

/**
 * OAuth (Google) and email-link landing. Exchanges the PKCE code for a session, accepts a pending invitation when
 * one was carried through, then routes like any other sign-in.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'), '/');
  const invite = url.searchParams.get('invite');
  const fail = (reason: string) => NextResponse.redirect(new URL(`/login?error=${reason}`, url.origin));

  if (!code) return fail('oauth');
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return fail('oauth');
  await recordSignIn(data.user);

  if (next === '/reset-password') return NextResponse.redirect(new URL('/reset-password', url.origin));

  if (invite && /^[A-Za-z0-9_-]{43}$/.test(invite)) {
    const { data: orgId } = await supabase.rpc('accept_invitation', { p_token_hash: await hashInviteToken(invite) });
    if (orgId) await setActiveOrg(orgId);
  }
  return NextResponse.redirect(new URL(await postSignInPath(next), url.origin));
}
