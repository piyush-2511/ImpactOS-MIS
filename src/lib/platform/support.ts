import 'server-only';
import type { z } from 'zod';
import { headers } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/user';
import { supabaseServer } from '@/lib/supabase/server';
import { fail, ok, type ActionResult } from '@/lib/actions/result';
import { ActionError, fromPgError } from '@/lib/actions/errors';
import { createElement } from 'react';
import type { Json } from '@/lib/supabase/database.types';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { notify } from '@/lib/notifications/notify';
import { sendEmail } from '@/lib/email/send';
import { SupportAccessGranted, supportAccessSubject } from '@/lib/email/templates/SupportAccessGranted';

/** Log a console action by ImpactOS staff (platform_audit_events). Never throws. */
export async function platformAudit(
  staffUserId: string,
  action: string,
  opts: { orgId?: string | null; target?: string; details?: Record<string, unknown> } = {},
) {
  const { error } = await supabaseAdmin()
    .from('platform_audit_events')
    .insert({
      staff_user_id: staffUserId,
      action,
      organization_id: opts.orgId ?? null,
      target: opts.target ?? null,
      details: (opts.details ?? null) as Json,
    });
  if (error) console.error('[platform-audit] insert failed', error.code);
}

/** The organisation's active support grant, if any. */
export async function activeGrant(orgId: string) {
  const { data } = await supabaseAdmin()
    .from('support_grants')
    .select('*')
    .eq('organization_id', orgId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Record that staff viewed organisation data under a grant (shown to the NGO in Admin → Support access). */
export async function logSupportView(orgId: string, staffUserId: string, view: string): Promise<boolean> {
  const grant = await activeGrant(orgId);
  if (!grant) return false;
  await supabaseAdmin()
    .from('support_access_log')
    .insert({ grant_id: grant.id, organization_id: orgId, staff_user_id: staffUserId, view: view.slice(0, 200) });
  return true;
}

async function secretaries(orgId: string) {
  const { data } = await supabaseAdmin()
    .from('organization_members')
    .select('user_id, profile:profiles!organization_members_profile_fkey(email, locale)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('base_role', 'secretary');
  return (data ?? []).map((m) => ({
    userId: m.user_id,
    email: m.profile?.email ?? null,
    locale: (m.profile?.locale ?? 'en') as 'en' | 'hi',
  }));
}

/** Ask the NGO's Secretaries for access (notification with a link to Admin → Support access). */
export async function requestAccess(orgId: string, staffUserId: string, reason: string) {
  const secs = await secretaries(orgId);
  await notify({
    orgId,
    userIds: secs.map((s) => s.userId),
    kind: 'support.access_requested',
    title: 'ImpactOS support asks for access',
    body: reason.slice(0, 300),
    link: '/admin/support-access',
  });
  await platformAudit(staffUserId, 'support.access_requested', { orgId, details: { reason } });
}

/**
 * Break-glass: one hour of read access without prior consent, for emergencies only (data loss, security incident).
 * Requires a written reason; every Secretary is notified by email and in the app at once.
 */
export async function breakGlass(orgId: string, staffUserId: string, reason: string) {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from('support_grants')
    .insert({
      organization_id: orgId,
      granted_by: null,
      reason,
      break_glass: true,
      requested_by: staffUserId,
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
    })
    .select('id, expires_at')
    .single();
  if (error || !data) throw error ?? new Error('break-glass failed');
  const secs = await secretaries(orgId);
  await notify({
    orgId,
    userIds: secs.map((s) => s.userId),
    kind: 'support.break_glass',
    title: 'ImpactOS used emergency access to your organisation',
    body: reason.slice(0, 300),
    link: '/admin/support-access',
  });
  for (const s of secs) {
    if (s.email)
      await sendEmail({
        to: s.email,
        subject: supportAccessSubject(s.locale, true),
        react: createElement(SupportAccessGranted, {
          locale: s.locale,
          breakGlass: true,
          reason,
          until: data.expires_at,
        }),
        tags: { kind: 'break_glass' },
      });
  }
  await platformAudit(staffUserId, 'support.break_glass', { orgId, target: data.id, details: { reason } });
  return data;
}

// ───────────────────────────── console actions ─────────────────────────────

export type StaffRole = 'super_admin' | 'support' | 'billing' | 'readonly';
export type ConsoleContext = {
  userId: string;
  role: StaffRole;
  supabase: Awaited<ReturnType<typeof supabaseServer>>;
  admin: ReturnType<typeof supabaseAdmin>;
};

/**
 * The console's equivalent of action(): console host, active platform staff, two-step verified session, allowed staff
 * role, zod input; then the handler; then a platform audit entry. Never throws to the browser.
 */
export function consoleAction<S extends z.ZodType, T>(
  config: {
    roles: StaffRole[];
    schema: S;
    audit?: (input: z.infer<S>) => { action: string; orgId?: string | null; target?: string };
  },
  handler: (input: z.infer<S>, ctx: ConsoleContext) => Promise<T>,
) {
  return async (raw: unknown): Promise<ActionResult<T>> => {
    if ((await headers()).get('x-impactos-host') !== 'console') return fail('forbidden');
    const user = await getCurrentUser();
    if (!user) return fail('unauthenticated');
    const supabase = await supabaseServer();
    const [{ data: staff }, { data: aal }] = await Promise.all([
      supabase.from('platform_staff').select('role, active').eq('user_id', user.id).maybeSingle(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ]);
    if (!staff?.active || aal?.currentLevel !== 'aal2') return fail('forbidden');
    if (staff.role !== 'super_admin' && !config.roles.includes(staff.role)) return fail('forbidden');
    const parsed = config.schema.safeParse(raw);
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const i of parsed.error.issues) fe[String(i.path[0] ?? 'form')] ??= i.message;
      return fail('invalid', fe);
    }
    try {
      const data = await handler(parsed.data, { userId: user.id, role: staff.role, supabase, admin: supabaseAdmin() });
      if (config.audit) {
        const a = config.audit(parsed.data);
        await platformAudit(user.id, a.action, {
          orgId: a.orgId,
          target: a.target,
          details: parsed.data as Record<string, unknown>,
        });
      }
      return ok(data);
    } catch (e) {
      if (e instanceof ActionError) return fail(e.code, e.fieldErrors);
      const pg = e as { code?: string };
      if (pg && typeof pg === 'object' && 'code' in pg) return fail(fromPgError(pg));
      console.error('[console-action] unexpected error', e);
      return fail('generic');
    }
  };
}
