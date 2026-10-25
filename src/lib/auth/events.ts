import 'server-only';
import { headers } from 'next/headers';
import { getLocale } from 'next-intl/server';
import type { AuthEvent } from '@/lib/supabase/database.types';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send';
import { NewDeviceEmail, newDeviceSubject } from '@/lib/email/templates/NewDevice';
import { formatDate } from '@/lib/i18n/format';

export async function requestMeta() {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
  const ua = h.get('user-agent')?.slice(0, 300) ?? null;
  return { ip, ua };
}

/** Device fingerprint for new-device alerts: browser string + IPv4 /24 (or IPv6 /48). Not used for anything else. */
export async function deviceHash(ua: string | null, ip: string | null): Promise<string> {
  const net = ip?.includes(':') ? ip.split(':').slice(0, 3).join(':') : ip?.split('.').slice(0, 3).join('.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ua ?? ''}|${net ?? ''}`));
  return Buffer.from(digest).toString('hex').slice(0, 32);
}

/** Records an auth event (service role; users can read their own). Never throws: logging must not block sign-in. */
export async function logAuthEvent(event: AuthEvent, opts: { userId?: string | null; orgId?: string | null } = {}) {
  try {
    const { ip, ua } = await requestMeta();
    await supabaseAdmin().from('auth_events').insert({
      event, user_id: opts.userId ?? null, organization_id: opts.orgId ?? null, ip, user_agent: ua, device_hash: await deviceHash(ua, ip),
    });
  } catch (e) {
    console.error('[auth_events] insert failed', (e as Error).message);
  }
}

/**
 * Logs a successful sign-in and emails the user when the device is new to this account (not on first sign-in,
 * and never to synthetic username addresses; sendEmail enforces the latter).
 */
export async function recordSignIn(user: { id: string; email?: string | null }, event: AuthEvent = 'sign_in') {
  try {
    const { ip, ua } = await requestMeta();
    const hash = await deviceHash(ua, ip);
    const admin = supabaseAdmin();
    const since = new Date(Date.now() - 180 * 24 * 3600 * 1000).toISOString();
    const { data: prior } = await admin.from('auth_events').select('device_hash').eq('user_id', user.id)
      .in('event', ['sign_in', 'username_login', 'console_sign_in']).gte('created_at', since).limit(200);
    await admin.from('auth_events').insert({ event, user_id: user.id, ip, user_agent: ua, device_hash: hash });
    const seen = (prior ?? []).some((p) => p.device_hash === hash);
    if (prior && prior.length > 0 && !seen && user.email) {
      const locale = (await getLocale()) === 'hi' ? 'hi' : 'en';
      await sendEmail({
        to: user.email,
        subject: newDeviceSubject(locale),
        react: NewDeviceEmail({ locale, when: `${formatDate(new Date(), locale)} ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })} IST`, device: ua ?? 'Unknown browser' }),
        tags: { kind: 'new_device' },
      });
    }
  } catch (e) {
    console.error('[auth] recordSignIn failed', (e as Error).message);
  }
}
