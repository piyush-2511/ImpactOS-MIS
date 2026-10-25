'use server';

import { revalidatePath } from 'next/cache';
import { consoleAction } from '@/lib/platform/support';
import { ActionError } from '@/lib/actions/errors';
import { financialYear } from '@/lib/i18n/format';
import { dueOrganisations, issueDueInvoice } from '@/lib/billing/invoice-run';
import { statusFromInvoices } from '@/lib/billing/read-only';
import { notify } from '@/lib/notifications/notify';
import type { ConsoleContext } from '@/lib/platform/support';
import { creditNoteSchema, paymentIdSchema, recordPaymentSchema, runSchema } from './schema';

const refresh = () => {
  revalidatePath('/console/billing');
  revalidatePath('/console');
};

/** After money arrives: mark the invoice paid when confirmed payments cover it, then recompute the subscription status. */
async function settle(ctx: ConsoleContext, invoiceId: string) {
  const { data: inv } = await ctx.admin
    .from('invoices')
    .select('id, organization_id, total_paise, number')
    .eq('id', invoiceId)
    .single();
  if (!inv) return;
  const { data: pays } = await ctx.admin
    .from('billing_payments')
    .select('amount_paise')
    .eq('invoice_id', invoiceId)
    .eq('status', 'confirmed');
  const paid = (pays ?? []).reduce((s, p) => s + p.amount_paise, 0);
  const { error } = await ctx.supabase
    .from('invoices')
    .update({
      paid_paise: paid,
      ...(paid >= inv.total_paise ? { status: 'paid', paid_at: new Date().toISOString() } : {}),
    })
    .eq('id', invoiceId);
  if (error) throw error;
  const [{ data: sub }, { data: open }] = await Promise.all([
    ctx.admin.from('subscriptions').select('status').eq('organization_id', inv.organization_id).single(),
    ctx.admin
      .from('invoices')
      .select('due_at')
      .eq('organization_id', inv.organization_id)
      .eq('status', 'issued')
      .order('due_at')
      .limit(1),
  ]);
  if (sub) {
    const next = statusFromInvoices(sub.status, open?.[0]?.due_at ?? null);
    if (next !== sub.status)
      await ctx.supabase
        .from('subscriptions')
        .update({ status: next as 'active', read_only_since: next === 'read_only' ? new Date().toISOString() : null })
        .eq('organization_id', inv.organization_id);
  }
  if (paid >= inv.total_paise) {
    const { data: secs } = await ctx.admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', inv.organization_id)
      .eq('status', 'active')
      .eq('base_role', 'secretary');
    await notify({
      orgId: inv.organization_id,
      userIds: (secs ?? []).map((s) => s.user_id),
      kind: 'billing.paid',
      title: `Payment received for invoice ${inv.number}. Thank you.`,
      link: '/admin/billing',
    });
  }
}

export const confirmPaymentAction = consoleAction(
  {
    roles: ['billing'],
    schema: paymentIdSchema,
    audit: (i) => ({ action: 'billing.payment_confirmed', target: i.paymentId }),
  },
  async (input, ctx) => {
    const { data: p, error } = await ctx.supabase
      .from('billing_payments')
      .update({
        status: 'confirmed',
        confirmed_by: ctx.userId,
        confirmed_at: new Date().toISOString(),
        note: input.note ?? null,
      })
      .eq('id', input.paymentId)
      .eq('status', 'submitted')
      .select('invoice_id')
      .single();
    if (error || !p) throw error ?? new ActionError('notFound');
    await settle(ctx, p.invoice_id);
    refresh();
    return null;
  },
);

export const rejectPaymentAction = consoleAction(
  {
    roles: ['billing'],
    schema: paymentIdSchema,
    audit: (i) => ({ action: 'billing.payment_rejected', target: i.paymentId }),
  },
  async (input, ctx) => {
    const { data: p, error } = await ctx.supabase
      .from('billing_payments')
      .update({
        status: 'rejected',
        confirmed_by: ctx.userId,
        confirmed_at: new Date().toISOString(),
        note: input.note ?? null,
      })
      .eq('id', input.paymentId)
      .eq('status', 'submitted')
      .select('organization_id, utr')
      .single();
    if (error || !p) throw error ?? new ActionError('notFound');
    const { data: secs } = await ctx.admin
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', p.organization_id)
      .eq('status', 'active')
      .eq('base_role', 'secretary');
    await notify({
      orgId: p.organization_id,
      userIds: (secs ?? []).map((s) => s.user_id),
      kind: 'billing.payment_rejected',
      title: `We could not find payment UTR ${p.utr}. Please check and submit again.`,
      body: input.note,
      link: '/admin/billing',
    });
    refresh();
    return null;
  },
);

/** A payment found on the bank statement that the NGO did not report. */
export const recordPaymentAction = consoleAction(
  {
    roles: ['billing'],
    schema: recordPaymentSchema,
    audit: (i) => ({ action: 'billing.payment_recorded', target: i.invoiceId }),
  },
  async (input, ctx) => {
    const { data: inv } = await ctx.admin
      .from('invoices')
      .select('organization_id, status')
      .eq('id', input.invoiceId)
      .single();
    if (!inv || inv.status !== 'issued') throw new ActionError('notOpen');
    const { error } = await ctx.admin.from('billing_payments').insert({
      invoice_id: input.invoiceId,
      organization_id: inv.organization_id,
      amount_paise: Math.round(input.amountRupees * 100),
      method: input.method,
      utr: input.utr,
      paid_on: input.paidOn,
      status: 'confirmed',
      submitted_by: ctx.userId,
      confirmed_by: ctx.userId,
      confirmed_at: new Date().toISOString(),
      note: 'Recorded from bank statement',
    });
    if (error) throw error;
    await settle(ctx, input.invoiceId);
    refresh();
    return null;
  },
);

/** Credit note: reduces the next invoice (issued invoices never change). */
export const creditNoteAction = consoleAction(
  { roles: ['billing'], schema: creditNoteSchema, audit: (i) => ({ action: 'billing.credit_note', orgId: i.orgId }) },
  async (input, ctx) => {
    const fy = financialYear(new Date());
    const { data: number } = await ctx.admin.rpc('next_platform_number', {
      p_key: 'credit_note',
      p_period: fy,
      p_prefix: `IOS-CN/${fy}/`,
    });
    const { error } = await ctx.admin
      .from('credit_notes')
      .insert({
        organization_id: input.orgId,
        invoice_id: input.invoiceId || null,
        number: number ?? '',
        amount_paise: Math.round(input.amountRupees * 100),
        reason: input.reason,
        created_by: ctx.userId,
      });
    if (error) throw error;
    refresh();
    return { number };
  },
);

/** Run invoicing now for every organisation whose period or trial has ended (the daily job does the same). */
export const runInvoicesAction = consoleAction(
  { roles: ['billing'], schema: runSchema, audit: () => ({ action: 'billing.invoice_run' }) },
  async () => {
    let issued = 0;
    for (const orgId of await dueOrganisations()) if (await issueDueInvoice(orgId)) issued++;
    refresh();
    return { issued };
  },
);
