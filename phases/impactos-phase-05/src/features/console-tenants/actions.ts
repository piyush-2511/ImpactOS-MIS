'use server';

import { revalidatePath } from 'next/cache';
import { createElement } from 'react';
import { consoleAction, breakGlass, requestAccess } from '@/lib/platform/support';
import { ActionError } from '@/lib/actions/errors';
import { generateInviteToken, hashInviteToken, inviteUrl } from '@/lib/auth/invites';
import { sendEmail } from '@/lib/email/send';
import { InviteEmail, inviteSubject } from '@/lib/email/templates/Invite';
import {
  accessSchema,
  breakGlassSchema,
  changePlanSchema,
  createTenantSchema,
  extendTrialSchema,
  notesSchema,
  setStatusSchema,
} from './schema';

const refresh = (orgId?: string) => {
  revalidatePath('/console/tenants');
  if (orgId) revalidatePath(`/console/tenants/${orgId}`);
};

/** Staff change: applies now (no proration; use a credit note or manual line if money is involved). */
export const changePlanAction = consoleAction(
  {
    roles: ['billing'],
    schema: changePlanSchema,
    audit: (i) => ({ action: 'tenant.plan_changed', orgId: i.orgId, target: i.planKey }),
  },
  async (input, ctx) => {
    const { error } = await ctx.supabase
      .from('subscriptions')
      .update({ plan_key: input.planKey, billing_period: input.period, pending_plan_key: null })
      .eq('organization_id', input.orgId);
    if (error) throw error;
    refresh(input.orgId);
    return null;
  },
);

export const extendTrialAction = consoleAction(
  {
    roles: ['billing', 'support'],
    schema: extendTrialSchema,
    audit: (i) => ({ action: 'tenant.trial_extended', orgId: i.orgId, target: `${i.days}d` }),
  },
  async (input, ctx) => {
    const { data: sub } = await ctx.supabase
      .from('subscriptions')
      .select('status, trial_ends_at')
      .eq('organization_id', input.orgId)
      .single();
    if (sub?.status !== 'trialing') throw new ActionError('notTrialing');
    const base = Math.max(Date.now(), new Date(sub.trial_ends_at ?? Date.now()).getTime());
    const { error } = await ctx.supabase
      .from('subscriptions')
      .update({ trial_ends_at: new Date(base + input.days * 86_400_000).toISOString() })
      .eq('organization_id', input.orgId);
    if (error) throw error;
    refresh(input.orgId);
    return null;
  },
);

/** Active / read-only / cancelled. Cancelling keeps data and a 90-day export window; nothing is deleted. */
export const setStatusAction = consoleAction(
  {
    roles: ['billing'],
    schema: setStatusSchema,
    audit: (i) => ({ action: 'tenant.status_changed', orgId: i.orgId, target: i.status }),
  },
  async (input, ctx) => {
    const now = new Date();
    const { error } = await ctx.supabase
      .from('subscriptions')
      .update({
        status: input.status,
        read_only_since: input.status === 'read_only' ? now.toISOString() : null,
        cancelled_at: input.status === 'cancelled' ? now.toISOString() : null,
        export_until: input.status === 'cancelled' ? new Date(now.getTime() + 90 * 86_400_000).toISOString() : null,
      })
      .eq('organization_id', input.orgId);
    if (error) throw error;
    refresh(input.orgId);
    return null;
  },
);

export const saveNotesAction = consoleAction(
  { roles: ['support', 'billing'], schema: notesSchema },
  async (input, ctx) => {
    const { error } = await ctx.supabase
      .from('subscriptions')
      .update({ console_notes: input.notes || null })
      .eq('organization_id', input.orgId);
    if (error) throw error;
    refresh(input.orgId);
    return null;
  },
);

export const requestAccessAction = consoleAction({ roles: ['support'], schema: accessSchema }, async (input, ctx) => {
  await requestAccess(input.orgId, ctx.userId, input.reason);
  return null;
});

export const breakGlassAction = consoleAction({ roles: ['support'], schema: breakGlassSchema }, async (input, ctx) => {
  const g = await breakGlass(input.orgId, ctx.userId, input.reason);
  refresh(input.orgId);
  return { expiresAt: g.expires_at };
});

/** Create an organisation for a customer (sales-led onboarding): the trial starts and the Secretary gets an invitation. */
export const createTenantAction = consoleAction(
  {
    roles: ['billing', 'support'],
    schema: createTenantSchema,
    audit: (i) => ({ action: 'tenant.created', target: i.slug }),
  },
  async (input, ctx) => {
    const { data: free } = await ctx.supabase.rpc('slug_available', { p_slug: input.slug });
    if (!free) throw new ActionError('slugTaken', undefined, { slug: 'slugTaken' });
    const { data: org, error } = await ctx.admin
      .from('organizations')
      .insert({
        name: input.name,
        slug: input.slug,
        legal_form: input.legalForm,
        state: input.state,
        locale: input.locale,
      } as never)
      .select('id')
      .single();
    if (error || !org) throw error ?? new ActionError('generic');
    await ctx.admin.from('subscriptions').update({ plan_key: input.planKey }).eq('organization_id', org.id);
    const { data: sec } = await ctx.admin
      .from('roles')
      .select('id')
      .eq('is_system', true)
      .eq('key', 'secretary')
      .single();
    const token = generateInviteToken();
    await ctx.admin
      .from('invitations')
      .insert({
        organization_id: org.id,
        email: input.secretaryEmail,
        role_id: sec?.id ?? null,
        role_key: 'member',
        token_hash: await hashInviteToken(token),
        locale: input.locale,
        invited_by: ctx.userId,
        expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      });
    await sendEmail({
      to: input.secretaryEmail,
      subject: inviteSubject(input.locale, input.name),
      react: createElement(InviteEmail, {
        locale: input.locale,
        inviter: 'ImpactOS',
        org: input.name,
        url: inviteUrl(process.env.NEXT_PUBLIC_APP_URL ?? '', token),
      }),
      tags: { kind: 'tenant_invite' },
    });
    refresh();
    return { id: org.id };
  },
);
