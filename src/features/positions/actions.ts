'use server';

import { revalidatePath } from 'next/cache';
import { action, check } from '@/lib/actions/action';
import { ActionError } from '@/lib/actions/errors';
import { appointSchema, holderIdSchema, positionIdSchema, positionSchema } from './schema';

const done = () => revalidatePath('/admin/positions');

export const savePositionAction = action(
  { permission: 'admin.positions.manage', schema: positionSchema },
  async (input, ctx) => {
    const values = {
      name: input.name,
      description: input.description || null,
      default_role_id: input.defaultRoleId || null,
      is_committee: input.isCommittee,
    };
    if (input.positionId) {
      check(
        await ctx.supabase.from('positions').update(values).eq('id', input.positionId).eq('organization_id', ctx.orgId),
      );
    } else {
      check(await ctx.supabase.from('positions').insert({ organization_id: ctx.orgId, ...values }));
    }
    done();
    return null;
  },
);

export const deletePositionAction = action(
  { permission: 'admin.positions.manage', schema: positionIdSchema },
  async (input, ctx) => {
    const { data: p } = await ctx.supabase
      .from('positions')
      .select('is_secretary')
      .eq('id', input.positionId)
      .maybeSingle();
    if (p?.is_secretary) throw new ActionError('secretaryPositionFixed');
    check(await ctx.supabase.from('positions').delete().eq('id', input.positionId).eq('organization_id', ctx.orgId));
    done();
    return null;
  },
);

/** Appoint someone to a position from a date. The Secretary position follows the Secretary role, not this form. */
export const appointHolderAction = action(
  { permission: 'admin.positions.manage', schema: appointSchema },
  async (input, ctx) => {
    const { data: p } = await ctx.supabase
      .from('positions')
      .select('is_secretary')
      .eq('id', input.positionId)
      .maybeSingle();
    if (p?.is_secretary) throw new ActionError('secretaryPositionFixed');
    check(
      await ctx.supabase
        .from('position_holders')
        .insert({
          position_id: input.positionId,
          member_id: input.memberId,
          organization_id: ctx.orgId,
          from_date: input.fromDate,
        }),
    );
    done();
    return null;
  },
);

export const endHoldingAction = action(
  { permission: 'admin.positions.manage', schema: holderIdSchema },
  async (input, ctx) => {
    check(
      await ctx.supabase
        .from('position_holders')
        .update({ to_date: new Date().toISOString().slice(0, 10) })
        .eq('id', input.holderId)
        .eq('organization_id', ctx.orgId),
    );
    done();
    return null;
  },
);
