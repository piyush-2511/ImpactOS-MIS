'use server';

import { revalidatePath } from 'next/cache';
import { consoleAction } from '@/lib/platform/support';
import { savePlanSchema } from './schema';

/** Prices, limits and modules. Price changes affect the next invoices only (issued invoices never change). */
export const savePlanAction = consoleAction(
  { roles: [], schema: savePlanSchema, audit: (i) => ({ action: 'plan.saved', target: i.key }) },
  async (input, ctx) => {
    const toPaise = (r: number) => Math.round(r * 100);
    const { error } = await ctx.supabase
      .from('plans')
      .update({
        name: input.name,
        description: input.description || null,
        monthly_paise: toPaise(input.monthlyRupees),
        annual_paise: toPaise(input.annualRupees),
        extra_seat_paise: toPaise(input.extraSeatRupees),
        donation_fee_bps: Math.round(input.donationFeePercent * 100),
        donation_fee_cap_paise: toPaise(input.donationFeeCapRupees),
        is_public: input.isPublic,
        active: input.active,
      })
      .eq('key', input.key);
    if (error) throw error;
    for (const [k, v] of Object.entries(input.limits)) {
      const { error: e } = await ctx.supabase
        .from('plan_limits')
        .upsert({ plan_key: input.key, limit_key: k as never, value: v });
      if (e) throw e;
    }
    await ctx.supabase.from('plan_modules').delete().eq('plan_key', input.key);
    if (input.modules.length) {
      const { error: e } = await ctx.supabase
        .from('plan_modules')
        .insert(input.modules.map((m) => ({ plan_key: input.key, module: m })));
      if (e) throw e;
    }
    revalidatePath('/console/plans');
    return null;
  },
);
