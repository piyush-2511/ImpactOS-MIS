import 'server-only';
import { render } from '@react-email/render';
import type { ReactElement } from 'react';
import { serverEnv } from '@/config/env';
import { isSyntheticEmail } from '@/lib/auth/username';
import { resend } from './client';

export type SendResult = { sent: boolean; id?: string; reason?: 'synthetic' | 'no-provider' | 'error' };

/**
 * Sends one transactional email. Never sends to synthetic username-account addresses. Without RESEND_API_KEY
 * (local development) the email is printed to the server log instead.
 */
export async function sendEmail({ to, subject, react, replyTo, tags }: {
  to: string; subject: string; react: ReactElement; replyTo?: string; tags?: Record<string, string>;
}): Promise<SendResult> {
  const env = serverEnv();
  if (isSyntheticEmail(to, env.SYNTHETIC_EMAIL_DOMAIN)) return { sent: false, reason: 'synthetic' };
  const [html, text] = await Promise.all([render(react), render(react, { plainText: true })]);
  const client = resend();
  if (!client) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${text}`);
    return { sent: false, reason: 'no-provider' };
  }
  const { data, error } = await client.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
    replyTo,
    tags: tags ? Object.entries(tags).map(([name, value]) => ({ name, value })) : undefined,
  });
  if (error) {
    console.error('[email] send failed', error.name);
    return { sent: false, reason: 'error' };
  }
  return { sent: true, id: data?.id };
}
