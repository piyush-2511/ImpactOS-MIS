import 'server-only';
import { Resend } from 'resend';
import { serverEnv } from '@/config/env';

let client: Resend | null = null;

/** Resend client, or null in local development without an API key (emails are then logged instead). */
export function resend(): Resend | null {
  const key = serverEnv().RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}
