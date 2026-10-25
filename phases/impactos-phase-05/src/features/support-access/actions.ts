'use server';

import { revalidatePath } from 'next/cache';
import { action, must } from '@/lib/actions/action';
import { grantSchema, revokeSchema } from './schema';

/** Secretary lets ImpactOS support view (never change) the organisation's records for 4, 24 or 72 hours. */
export const grantSupportAction = action(
  { permission: 'admin.support.manage', schema: grantSchema, allowReadOnly: true },
  async (input, ctx) => {
    const id = must(
      await ctx.supabase.rpc('grant_support_access', {
        p_org: ctx.orgId,
        p_hours: input.hours,
        p_reason: input.reason,
      }),
    );
    revalidatePath('/admin/support-access');
    return { id };
  },
);

export const revokeSupportAction = action(
  { permission: 'admin.support.manage', schema: revokeSchema, allowReadOnly: true },
  async (input, ctx) => {
    await ctx.supabase.rpc('revoke_support_access', { p_grant: input.grantId });
    revalidatePath('/admin/support-access');
    return null;
  },
);
