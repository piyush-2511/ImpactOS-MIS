import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { getPlanInfo, getUsage } from '@/lib/billing/limits';

export type InvoiceRow = {
  id: string;
  number: string | null;
  status: 'issued' | 'paid' | 'void';
  periodStart: string;
  periodEnd: string;
  issuedAt: string | null;
  dueAt: string | null;
  totalPaise: number;
  paidPaise: number;
  pdfFileId: string | null;
  overdue: boolean;
  payments: { utr: string; status: string; amountPaise: number; paidOn: string }[];
};
export type PlanOption = {
  key: string;
  name: string;
  description: string | null;
  monthlyPaise: number;
  annualPaise: number;
  limits: Record<string, number | null>;
  modules: string[];
};

/** Everything Admin → Billing shows (RLS: invoices and payments need admin.billing.manage). */
export async function billingOverview(orgId: string) {
  const supabase = await supabaseServer();
  const [plan, usage, { data: plans }, { data: limits }, { data: modules }, { data: invoices }, { data: unbilled }] =
    await Promise.all([
      getPlanInfo(orgId),
      getUsage(orgId),
      supabase
        .from('plans')
        .select('key, name, description, monthly_paise, annual_paise')
        .eq('active', true)
        .eq('is_public', true)
        .order('sort_order'),
      supabase.from('plan_limits').select('plan_key, limit_key, value'),
      supabase.from('plan_modules').select('plan_key, module'),
      supabase
        .from('invoices')
        .select(
          'id, number, status, period_start, period_end, issued_at, due_at, total_paise, paid_paise, pdf_file_id, billing_payments(utr, status, amount_paise, paid_on)',
        )
        .eq('organization_id', orgId)
        .neq('status', 'draft')
        .order('period_start', { ascending: false })
        .limit(36),
      supabase.from('usage_records').select('amount_paise').eq('organization_id', orgId).is('invoice_id', null),
    ]);
  const now = Date.now();
  const options: PlanOption[] = (plans ?? []).map((p) => ({
    key: p.key,
    name: p.name,
    description: p.description,
    monthlyPaise: p.monthly_paise,
    annualPaise: p.annual_paise,
    limits: Object.fromEntries((limits ?? []).filter((l) => l.plan_key === p.key).map((l) => [l.limit_key, l.value])),
    modules: (modules ?? []).filter((m) => m.plan_key === p.key).map((m) => m.module),
  }));
  const rows: InvoiceRow[] = (invoices ?? []).map((i) => ({
    id: i.id,
    number: i.number,
    status: i.status as InvoiceRow['status'],
    periodStart: i.period_start,
    periodEnd: i.period_end,
    issuedAt: i.issued_at,
    dueAt: i.due_at,
    totalPaise: i.total_paise,
    paidPaise: i.paid_paise,
    pdfFileId: i.pdf_file_id,
    overdue: i.status === 'issued' && !!i.due_at && new Date(i.due_at).getTime() < now,
    payments: i.billing_payments.map((p) => ({
      utr: p.utr,
      status: p.status,
      amountPaise: p.amount_paise,
      paidOn: p.paid_on,
    })),
  }));
  return {
    plan,
    usage,
    options,
    invoices: rows,
    unbilledPaise: (unbilled ?? []).reduce((s, u) => s + u.amount_paise, 0),
  };
}
