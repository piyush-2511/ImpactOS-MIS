'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { publicEnv } from '@/config/env';
import { LOCALE_COOKIE } from '@/lib/i18n/config';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getCurrentUser, getProfile, safeNext } from '@/lib/auth/user';
import { roleNeedsMfa } from '@/lib/auth/aal';
import { isDisposableEmail } from '@/lib/auth/disposable-domains';
import { hashInviteToken } from '@/lib/auth/invites';
import { limit } from '@/lib/auth/ratelimit';
import { verifyTurnstile } from '@/lib/auth/turnstile';
import { logAuthEvent, recordSignIn, requestMeta } from '@/lib/auth/events';
import { setActiveOrg, listMyOrgs } from '@/lib/org/active-org';
import { sendEmail } from '@/lib/email/send';
import { PasswordChangedEmail, passwordChangedSubject } from '@/lib/email/templates/PasswordChanged';
import {
  emailOnlySchema, fieldErrors, inviteSignUpSchema, newPasswordSchema, setupOrgSchema, signInSchema, signUpSchema, verifySchema,
  type ActionState,
} from './schema';

const str = (fd: FormData, k: string) => (fd.get(k) ?? '').toString();

/**
 * Where to go after a successful sign-in: forced password change → organisation setup → MFA → requested page.
 * Used by server actions, the OAuth callback and the username-login route.
 */
export async function postSignInPath(next?: string | null): Promise<string> {
  const target = safeNext(next, '/');
  const profile = await getProfile();
  if (profile?.must_change_password) return `/change-password?next=${encodeURIComponent(target)}`;
  const orgs = await listMyOrgs();
  if (!orgs.length) return '/setup-org';
  const supabase = await supabaseServer();
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const needs = orgs.some((m) => roleNeedsMfa(m.role));
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return `/mfa?next=${encodeURIComponent(target)}`;
  if (needs && aal?.currentLevel !== 'aal2') return `/mfa/setup?next=${encodeURIComponent(target)}`;
  return target;
}

export async function signUpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: str(fd, 'fullName'), email: str(fd, 'email'), password: str(fd, 'password'), locale: str(fd, 'locale') || 'en',
    turnstileToken: str(fd, 'cf-turnstile-response') || undefined,
  });
  const values = { fullName: str(fd, 'fullName'), email: str(fd, 'email') };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { ip } = await requestMeta();
  const rl = await limit('signup', `${ip ?? 'unknown'}`);
  if (!rl.ok) return { error: 'rateLimited', values };
  if (isDisposableEmail(parsed.data.email)) return { fieldErrors: { email: 'emailDisposable' }, values };
  if (!(await verifyTurnstile(parsed.data.turnstileToken, ip))) return { error: 'captchaFailed', values };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName, locale: parsed.data.locale } },
  });
  if (error) {
    if (/weak|pwned|leaked/i.test(error.message)) return { fieldErrors: { password: 'passwordWeak' }, values };
    if (/already/i.test(error.message)) return { error: 'emailTaken', values };
    return { error: 'generic', values };
  }
  (await cookies()).set(LOCALE_COOKIE, parsed.data.locale, { path: '/', maxAge: 31536000, sameSite: 'lax' });
  await logAuthEvent('sign_up');
  redirect(`/verify?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function verifyCodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = verifySchema.safeParse({ email: str(fd, 'email'), code: str(fd, 'code') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.verifyOtp({ email: parsed.data.email, token: parsed.data.code, type: 'email' });
  if (error || !data.user) return { fieldErrors: { code: 'codeWrong' } };
  await recordSignIn(data.user);
  redirect(await postSignInPath(str(fd, 'next')));
}

export async function resendCodeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse({ email: str(fd, 'email') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const rl = await limit('resendCode', parsed.data.email);
  if (!rl.ok) return { error: 'rateLimited' };
  const supabase = await supabaseServer();
  await supabase.auth.resend({ type: 'signup', email: parsed.data.email });
  return { ok: true, info: 'codeResent' };
}

export async function signInAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({ email: str(fd, 'email'), password: str(fd, 'password'), next: str(fd, 'next') });
  const values = { email: str(fd, 'email') };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { ip } = await requestMeta();
  const rl = await limit('login', `${parsed.data.email}|${ip ?? ''}`);
  if (!rl.ok) return { error: 'rateLimited', values };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) {
    if (/not confirmed/i.test(error?.message ?? '')) redirect(`/verify?email=${encodeURIComponent(parsed.data.email)}`);
    await logAuthEvent('sign_in_failed');
    return { error: 'invalidCredentials', values };
  }
  await recordSignIn(data.user);
  redirect(await postSignInPath(parsed.data.next));
}

export async function setupOrgAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/setup-org');
  const raw = {
    name: str(fd, 'name'), slug: str(fd, 'slug'), legalForm: str(fd, 'legalForm'), state: str(fd, 'state'), district: str(fd, 'district'),
    pan: str(fd, 'pan'), fcra: fd.get('fcra') === 'on', locale: str(fd, 'locale') || 'en',
  };
  const values = Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, String(v)]));
  const parsed = setupOrgSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const supabase = await supabaseServer();
  const d = parsed.data;
  const { data: orgId, error } = await supabase.rpc('create_organization', {
    p_name: d.name, p_slug: d.slug, p_legal_form: d.legalForm, p_state: d.state, p_district: d.district || null,
    p_pan: d.pan || null, p_fcra: d.fcra, p_locale: d.locale,
  });
  if (error || !orgId) {
    if (error?.code === '23505') return { fieldErrors: { slug: 'slugTaken' }, values };
    if (/limit/i.test(error?.message ?? '')) return { error: 'orgLimit', values };
    if (/verify/i.test(error?.message ?? '')) return { error: 'emailNotVerified', values };
    return { error: 'generic', values };
  }
  await setActiveOrg(orgId);
  redirect(await postSignInPath('/'));
}

export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = emailOnlySchema.safeParse({ email: str(fd, 'email') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const rl = await limit('passwordReset', parsed.data.email);
  if (rl.ok) {
    const supabase = await supabaseServer();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/api/auth/callback?next=/reset-password`,
    });
    await logAuthEvent('password_reset_requested');
  }
  // Same answer whether or not the account exists (no account enumeration).
  return { ok: true, info: 'resetSent' };
}

async function finishPasswordChange(fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const parsed = newPasswordSchema.safeParse({ password: str(fd, 'password'), confirm: str(fd, 'confirm') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return /weak|pwned|leaked/i.test(error.message) ? { fieldErrors: { password: 'passwordWeak' } } : /same/i.test(error.message) ? { fieldErrors: { password: 'passwordSame' } } : { error: 'generic' };
  await supabaseAdmin().from('profiles').update({ must_change_password: false }).eq('id', user.id);
  await supabase.auth.signOut({ scope: 'others' });
  await logAuthEvent('password_changed', { userId: user.id });
  if (user.email) {
    const locale = (await getLocale()) === 'hi' ? 'hi' : 'en';
    await sendEmail({ to: user.email, subject: passwordChangedSubject(locale), react: PasswordChangedEmail({ locale }), tags: { kind: 'password_changed' } });
  }
  return { ok: true };
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await finishPasswordChange(fd);
  if (!res.ok) return res;
  redirect(await postSignInPath(str(fd, 'next')));
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const res = await finishPasswordChange(fd);
  if (!res.ok) return res;
  redirect(await postSignInPath('/'));
}

export async function acceptInviteAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  const token = str(fd, 'token');
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  let hash: string;
  try {
    hash = await hashInviteToken(token);
  } catch {
    return { error: 'inviteInvalid' };
  }
  const supabase = await supabaseServer();
  const { data: orgId, error } = await supabase.rpc('accept_invitation', { p_token_hash: hash });
  if (error || !orgId) return { error: /email/i.test(error?.message ?? '') ? 'inviteWrongEmail' : /expired/i.test(error?.message ?? '') ? 'inviteExpired' : 'inviteInvalid' };
  await setActiveOrg(orgId);
  redirect(await postSignInPath('/'));
}

/** New person accepting an invitation: the emailed token proves the inbox, so the account is created verified. */
export async function inviteSignUpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = inviteSignUpSchema.safeParse({ token: str(fd, 'token'), fullName: str(fd, 'fullName'), password: str(fd, 'password') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const hash = await hashInviteToken(parsed.data.token);
  const admin = supabaseAdmin();
  const { data: rows } = await admin.rpc('get_invitation', { p_token_hash: hash });
  const inv = rows?.[0];
  if (!inv || inv.state !== 'open') return { error: inv?.state === 'expired' ? 'inviteExpired' : 'inviteInvalid' };
  const { error: createErr } = await admin.auth.admin.createUser({
    email: inv.email, password: parsed.data.password, email_confirm: true, user_metadata: { full_name: parsed.data.fullName, locale: inv.locale },
  });
  if (createErr) return /already/i.test(createErr.message) ? { error: 'inviteHasAccount' } : /weak|pwned/i.test(createErr.message) ? { fieldErrors: { password: 'passwordWeak' } } : { error: 'generic' };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email: inv.email, password: parsed.data.password });
  if (error || !data.user) return { error: 'generic' };
  await recordSignIn(data.user);
  const { data: orgId, error: accErr } = await supabase.rpc('accept_invitation', { p_token_hash: hash });
  if (accErr || !orgId) return { error: 'inviteInvalid' };
  await setActiveOrg(orgId);
  redirect(await postSignInPath('/'));
}

export async function signOutAction(fd: FormData): Promise<void> {
  const scope = str(fd, 'scope') === 'global' ? 'global' : 'local';
  const user = await getCurrentUser();
  const supabase = await supabaseServer();
  await supabase.auth.signOut({ scope });
  if (user) await logAuthEvent('sign_out', { userId: user.id });
  redirect('/login');
}

/** ImpactOS staff sign-in on the console host. Non-staff get the same error as a wrong password. */
export async function consoleSignInAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = signInSchema.safeParse({ email: str(fd, 'email'), password: str(fd, 'password') });
  const values = { email: str(fd, 'email') };
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  const { ip } = await requestMeta();
  const rl = await limit('login', `console|${parsed.data.email}|${ip ?? ''}`);
  if (!rl.ok) return { error: 'rateLimited', values };
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data.user) return { error: 'invalidCredentials', values };
  const { data: staff } = await supabase.from('platform_staff').select('active').eq('user_id', data.user.id).maybeSingle();
  if (!staff?.active) {
    await supabase.auth.signOut({ scope: 'local' });
    await logAuthEvent('sign_in_failed', { userId: data.user.id });
    return { error: 'invalidCredentials', values };
  }
  await recordSignIn(data.user, 'console_sign_in');
  const store = await cookies();
  const now = String(Date.now());
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' };
  store.set('ios_console_start', now, opts);
  store.set('ios_console_seen', now, opts);
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const next = safeNext(str(fd, 'next'), '/console');
  redirect(aal?.nextLevel === 'aal2' ? `/mfa?next=${encodeURIComponent(next)}` : `/mfa/setup?next=${encodeURIComponent(next)}`);
}

