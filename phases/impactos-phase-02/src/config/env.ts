import { z } from 'zod';

/**
 * Environment validation. The app refuses to start when a required variable is missing.
 * Public values are read literally (process.env.NEXT_PUBLIC_*) so Next.js can inline them in the browser bundle.
 * Every variable is documented in `.env.example` with the phase that starts using it.
 */
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
const isProdRuntime = process.env.NODE_ENV === 'production' && !isBuild;

const requiredInProd = (name: string) =>
  z
    .string()
    .optional()
    .superRefine((v, ctx) => {
      if (isProdRuntime && !v) ctx.addIssue({ code: 'custom', message: `${name} is required in production` });
    });

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: requiredInProd('NEXT_PUBLIC_APP_URL').transform((v) => v || 'http://localhost:3000'),
  NEXT_PUBLIC_ROOT_DOMAIN: requiredInProd('NEXT_PUBLIC_ROOT_DOMAIN').transform((v) => v || 'localhost:3000'),
  NEXT_PUBLIC_SUPABASE_URL: requiredInProd('NEXT_PUBLIC_SUPABASE_URL').transform((v) => v || ''),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: requiredInProd('NEXT_PUBLIC_SUPABASE_ANON_KEY').transform((v) => v || ''),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
});

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: requiredInProd('SUPABASE_SERVICE_ROLE_KEY'),
  ORG_COOKIE_SECRET: requiredInProd('ORG_COOKIE_SECRET').superRefine((v, ctx) => {
    if (v && v.length < 32) ctx.addIssue({ code: 'custom', message: 'ORG_COOKIE_SECRET must be at least 32 characters' });
  }),
  RESEND_API_KEY: requiredInProd('RESEND_API_KEY'),
  EMAIL_FROM: z.string().default('ImpactOS <no-reply@mail.theimpactos.in>'),
  SEND_EMAIL_HOOK_SECRET: requiredInProd('SEND_EMAIL_HOOK_SECRET'),
  TURNSTILE_SECRET_KEY: requiredInProd('TURNSTILE_SECRET_KEY'),
  UPSTASH_REDIS_REST_URL: requiredInProd('UPSTASH_REDIS_REST_URL'),
  UPSTASH_REDIS_REST_TOKEN: requiredInProd('UPSTASH_REDIS_REST_TOKEN'),
  SYNTHETIC_EMAIL_DOMAIN: z.string().default('users.id.theimpactos.in'),
  CONSOLE_IP_ALLOWLIST: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
});

function format(error: z.ZodError) {
  return error.issues.map((i) => `  - ${i.path.join('.') || 'value'}: ${i.message}`).join('\n');
}

const publicParsed = publicSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
});
if (!publicParsed.success) {
  throw new Error(`ImpactOS cannot start: invalid public environment variables\n${format(publicParsed.error)}`);
}

export const publicEnv = publicParsed.data;

const scheme = (root: string) => (root.startsWith('localhost') ? 'http' : 'https');
/** https://console.theimpactos.in (http://console.localhost:3000 in development). */
export const consoleUrl = () => `${scheme(publicEnv.NEXT_PUBLIC_ROOT_DOMAIN)}://console.${publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}`;
/** https://theimpactos.in (marketing site). */
export const siteUrl = () => `${scheme(publicEnv.NEXT_PUBLIC_ROOT_DOMAIN)}://${publicEnv.NEXT_PUBLIC_ROOT_DOMAIN}`;

let cached: z.infer<typeof serverSchema> | null = null;
/** Server-only variables. Import only from server code (route handlers, server actions, instrumentation). */
export function serverEnv() {
  if (cached) return cached;
  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`ImpactOS cannot start: invalid server environment variables\n${format(parsed.error)}`);
  }
  cached = parsed.data;
  return cached;
}
