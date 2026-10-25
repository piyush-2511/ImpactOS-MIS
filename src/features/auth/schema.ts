import { z } from 'zod';
import { USERNAME_RE } from '@/lib/auth/username';

/** Shared by forms and server actions. Messages are i18n keys in the `auth.errors` namespace. */
const email = z.string().trim().toLowerCase().email('emailInvalid').max(254, 'emailInvalid');
const password = z.string().min(10, 'passwordShort').max(72, 'passwordLong');
const locale = z.enum(['en', 'hi']).default('en');
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const signUpSchema = z.object({
  fullName: z.string().trim().min(2, 'nameShort').max(120, 'nameLong'),
  email,
  password,
  locale,
  turnstileToken: z.string().optional(),
});

export const signInSchema = z.object({ email, password: z.string().min(1, 'passwordRequired').max(72), next: z.string().optional() });

export const usernameSignInSchema = z.object({
  orgCode: z.string().trim().toLowerCase().regex(SLUG_RE, 'orgCodeInvalid'),
  username: z.string().trim().toLowerCase().regex(USERNAME_RE, 'usernameInvalid'),
  password: z.string().min(1, 'passwordRequired').max(72),
  next: z.string().optional(),
});

export const verifySchema = z.object({ email, code: z.string().trim().regex(/^\d{6}$/, 'codeInvalid') });

export const emailOnlySchema = z.object({ email });

export const setupOrgSchema = z.object({
  name: z.string().trim().min(2, 'orgNameShort').max(120, 'orgNameLong'),
  slug: z.string().trim().toLowerCase().regex(SLUG_RE, 'slugInvalid'),
  legalForm: z.enum(['trust', 'society', 'section8', 'other'], { message: 'legalFormRequired' }),
  state: z.string().trim().min(2, 'stateRequired').max(60),
  district: z.string().trim().max(60).optional().or(z.literal('')),
  pan: z.string().trim().toUpperCase().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, 'panInvalid').optional().or(z.literal('')),
  fcra: z.boolean().default(false),
  locale,
});

export const newPasswordSchema = z
  .object({ password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'passwordMismatch', path: ['confirm'] });

export const inviteSignUpSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/, 'inviteInvalid'), fullName: z.string().trim().min(2, 'nameShort').max(120), password });

/** Suggest a subdomain from an organisation name: "Ambedkar Foundation, Gaya" → "ambedkar-foundation-gaya". */
export function slugify(name: string): string {
  return name.toLowerCase().normalize('NFKD').replace(/[^\x00-\x7F]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/, '');
}

export type ActionState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; info?: string; values?: Record<string, string> };

export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const k = String(i.path[0] ?? 'form');
    out[k] ??= i.message;
  }
  return out;
}
