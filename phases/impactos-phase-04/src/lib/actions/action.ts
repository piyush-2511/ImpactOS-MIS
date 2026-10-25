import 'server-only';
import type { User } from '@supabase/supabase-js';
import type { z } from 'zod';
import { supabaseServer } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/user';
import { getActiveOrg, type Membership } from '@/lib/org/active-org';
import { getPermissions } from '@/lib/authz/can';
import { hasPermission } from '@/lib/authz/permissions';
import { ActionError, fromPgError } from './errors';
import { audit } from './audit';
import { fail, ok, type ActionResult } from './result';

export type ActionContext = {
  user: User;
  org: Membership;
  orgId: string;
  supabase: Awaited<ReturnType<typeof supabaseServer>>;
  permissions: string[];
  can: (perm: string) => boolean;
};

type Config<S extends z.ZodType> = {
  /** Required permission in the active organisation. Omit only for actions every member may run. */
  permission?: string;
  schema: S;
  /** Audit action name written after success (row changes are also audited by triggers). */
  audit?: string | ((input: z.infer<S>) => { action: string; table?: string; rowId?: string; note?: string });
};

function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0] ?? 'form')] ??= i.message;
  return out;
}

/**
 * The only way writes enter the app (hard rule 4). Order: verify user (getUser) → active organisation →
 * plan (phase 5) → permission → validate with zod → run with the user-scoped client (RLS applies) → audit.
 * Returns ActionResult; never throws to the browser and never leaks database messages.
 */
export function action<S extends z.ZodType, T>(
  config: Config<S>,
  handler: (input: z.infer<S>, ctx: ActionContext) => Promise<T>,
) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    const user = await getCurrentUser();
    if (!user) return fail('unauthenticated');
    const org = await getActiveOrg();
    if (!org) return fail('noOrganisation');
    // Phase 5 adds: plan allows the module and the organisation is not read-only.
    const permissions = await getPermissions(org.organization.id);
    if (config.permission && !hasPermission(permissions, config.permission)) return fail('forbidden');
    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) return fail('invalid', zodFieldErrors(parsed.error));
    const supabase = await supabaseServer();
    const ctx: ActionContext = {
      user,
      org,
      orgId: org.organization.id,
      supabase,
      permissions,
      can: (p) => hasPermission(permissions, p),
    };
    try {
      const data = await handler(parsed.data, ctx);
      if (config.audit) {
        const a = typeof config.audit === 'string' ? { action: config.audit } : config.audit(parsed.data);
        await audit(ctx.orgId, a.action, a);
      }
      return ok(data);
    } catch (e) {
      if (e instanceof ActionError) return fail(e.code, e.fieldErrors);
      const pg = e as { code?: string; message?: string };
      if (pg && typeof pg === 'object' && 'code' in pg) return fail(fromPgError(pg));
      console.error('[action] unexpected error', e);
      return fail('generic');
    }
  };
}

/** Throw inside a handler when a Supabase call fails, so the wrapper maps the error code. */
export function check<T>(res: { data: T; error: { code?: string; message?: string } | null }): T {
  if (res.error) throw new ActionError(fromPgError(res.error));
  return res.data;
}

/** Like check(), for calls that must return a row (`.single()`): a missing row becomes a "notFound" error. */
export function must<T>(res: { data: T; error: { code?: string; message?: string } | null }): NonNullable<T> {
  if (res.error) throw new ActionError(fromPgError(res.error));
  if (res.data === null || res.data === undefined) throw new ActionError('notFound');
  return res.data as NonNullable<T>;
}
