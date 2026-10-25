'use server';

import { revalidatePath } from 'next/cache';
import { action, check } from '@/lib/actions/action';
import { ActionError } from '@/lib/actions/errors';
import { getUsage } from '@/lib/billing/limits';
import { upgradeCharge } from '@/lib/billing/proration';
import { formatPaise } from '@/lib/billing/plans';
import { notify } from '@/lib/notifications/notify';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { choosePlanSchema, submitPaymentSchema } from './schema';

const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

/**
 * Choose or change plan. During the trial: sets the plan the first invoice will use. After: upgrades apply now and
 * the rest of this period is charged pro rata on the next invoice; downgrades apply from the next period. A downgrade
 * is refused while current usage is above the smaller plan's limits. (Subscription rows are billing state, written
 * with the service role after the permission check.)
 */
export const choosePlanAction = action(
  { permission: 'admin.billing.manage', schema: choosePlanSchema, allowReadOnly: true },
  async (input, ctx) => {
    const db = supabaseAdmin();
    const [{ data: sub }, { data: target }, { data: current }, { data: limits }] = await Promise.all([
      db.from('subscriptions').select('*').eq('organization_id', ctx.orgId).single(),
      db.from('plans').select('*').eq('key', input.planKey).eq('active', true).eq('is_public', true).maybeSingle(),
      db
        .from('subscriptions')
        .select('plan:plans(monthly_paise, annual_paise)')
        .eq('organization_id', ctx.orgId)
        .single(),
      db.from('plan_limits').select('limit_key, value').eq('plan_key', input.planKey),
    ]);
    if (!sub || !target) throw new ActionError('notFound');
    if (sub.status === 'cancelled') throw new ActionError('forbidden');
    const usage = await getUsage(ctx.orgId);
    const over = (limits ?? [])
      .filter((l) => l.value !== null && (usage[l.limit_key] ?? 0) > l.value)
      .map((l) => l.limit_key);
    const priceOf = (p: { monthly_paise: number; annual_paise: number }, period: 'monthly' | 'annual') =>
      period === 'annual' ? p.annual_paise : p.monthly_paise;
    const oldPrice = current?.plan ? priceOf(current.plan, sub.billing_period) : 0;
    const newPrice = priceOf(target, input.period);

    if (sub.status === 'trialing') {
      if (over.length)
        throw new ActionError('downgradeBlocked', undefined, Object.fromEntries(over.map((k) => [k, 'over'])));
      check(
        await db
          .from('subscriptions')
          .update({ plan_key: target.key, billing_period: input.period, plan_chosen: true })
          .eq('organization_id', ctx.orgId),
      );
    } else if (newPrice >= oldPrice && sub.current_period_start && sub.current_period_end) {
      const charge = upgradeCharge(oldPrice, newPrice, sub.current_period_start, sub.current_period_end, todayIst());
      check(
        await db
          .from('subscriptions')
          .update({ plan_key: target.key, pending_plan_key: null, plan_chosen: true })
          .eq('organization_id', ctx.orgId),
      );
      if (charge > 0) {
        check(
          await db
            .from('usage_records')
            .insert({
              organization_id: ctx.orgId,
              kind: 'proration',
              description: `Upgrade to ${target.name} from ${todayIst()} (${formatPaise(charge)})`,
              amount_paise: charge,
              created_by: ctx.user.id,
            }),
        );
      }
    } else {
      if (over.length)
        throw new ActionError('downgradeBlocked', undefined, Object.fromEntries(over.map((k) => [k, 'over'])));
      check(
        await db
          .from('subscriptions')
          .update({ pending_plan_key: target.key, billing_period: input.period, plan_chosen: true })
          .eq('organization_id', ctx.orgId),
      );
    }
    revalidatePath('/admin/billing');
    return { applied: sub.status === 'trialing' ? 'trial' : newPrice >= oldPrice ? 'now' : 'nextPeriod' };
  },
);

/** The NGO reports a payment (UTR). ImpactOS billing confirms it against the bank statement. */
export const submitPaymentAction = action(
  { permission: 'admin.billing.manage', schema: submitPaymentSchema, allowReadOnly: true },
  async (input, ctx) => {
    check(
      await ctx.supabase.rpc('submit_invoice_payment', {
        p_invoice: input.invoiceId,
        p_amount_paise: Math.round(input.amountRupees * 100),
        p_method: input.method,
        p_utr: input.utr,
        p_paid_on: input.paidOn,
      }),
    );
    const { data: staff } = await supabaseAdmin()
      .from('platform_staff')
      .select('user_id')
      .eq('active', true)
      .in('role', ['super_admin', 'billing']);
    await notify({
      orgId: null,
      userIds: (staff ?? []).map((s) => s.user_id),
      kind: 'billing.payment_submitted',
      title: `${ctx.org.organization.name} reported a payment (UTR ${input.utr})`,
      link: '/console/billing',
    });
    revalidatePath('/admin/billing');
    return null;
  },
);
