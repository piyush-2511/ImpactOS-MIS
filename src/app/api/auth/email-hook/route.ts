import { NextResponse, type NextRequest } from 'next/server';
import { Webhook } from 'standardwebhooks';
import { publicEnv, serverEnv } from '@/config/env';
import { sendEmail } from '@/lib/email/send';
import { VerifyCodeEmail, verifyCodeSubject, type CodePurpose } from '@/lib/email/templates/VerifyCode';

type HookPayload = {
  user: { email: string; user_metadata?: { locale?: string } };
  email_data: { token: string; token_hash: string; redirect_to: string; email_action_type: string; site_url: string };
};

const PURPOSES: Record<string, CodePurpose> = {
  signup: 'signup', email_change: 'email_change', email: 'email_change', reauthentication: 'reauthentication', recovery: 'recovery', magiclink: 'magiclink',
};

/**
 * Supabase Auth "Send Email" hook: Supabase calls this instead of sending its own emails, so verification codes and
 * password resets use ImpactOS's bilingual templates and sender. Signed with Standard Webhooks (SEND_EMAIL_HOOK_SECRET).
 */
export async function POST(request: NextRequest) {
  const secret = serverEnv().SEND_EMAIL_HOOK_SECRET;
  if (!secret) return NextResponse.json({ error: { http_code: 500, message: 'Email hook is not configured' } }, { status: 500 });
  const raw = await request.text();
  let payload: HookPayload;
  try {
    payload = new Webhook(secret.replace(/^v1,whsec_/, '')).verify(raw, Object.fromEntries(request.headers)) as HookPayload;
  } catch {
    return NextResponse.json({ error: { http_code: 401, message: 'Invalid signature' } }, { status: 401 });
  }
  const { user, email_data: d } = payload;
  const purpose = PURPOSES[d.email_action_type];
  if (!purpose) return NextResponse.json({}, { status: 200 });
  const locale = user.user_metadata?.locale === 'hi' ? 'hi' : 'en';
  const supabaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL || d.site_url;
  const link = purpose === 'recovery'
    ? `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(d.token_hash)}&type=recovery&redirect_to=${encodeURIComponent(d.redirect_to)}`
    : undefined;
  const res = await sendEmail({
    to: user.email,
    subject: verifyCodeSubject(locale, purpose),
    react: VerifyCodeEmail({ locale, purpose, code: purpose === 'recovery' ? undefined : d.token, link }),
    tags: { kind: `auth_${purpose}` },
  });
  if (!res.sent && res.reason === 'error') {
    return NextResponse.json({ error: { http_code: 502, message: 'Email provider error' } }, { status: 502 });
  }
  return NextResponse.json({}, { status: 200 });
}
