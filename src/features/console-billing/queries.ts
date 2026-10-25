import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dueOrganisations } from '@/lib/billing/invoice-run';

export type ConsoleInvoice = {
  id: string;
  number: string | null;
  orgId: string;
  orgName: string;
  status: string;
  totalPaise: number;
  paidPaise: number;
  dueAt: string | null;
  overdue: boolean;
  periodStart: string;
};
export type PendingPayment = {
  id: string;
  invoiceId: string;
  invoiceNumber: string | null;
  orgName: string;
  amountPaise: number;
  utr: string;
  method: string;
  paidOn: string;
  submittedAt: string;
  invoiceTotal: number;
};

export async function consoleBilling(status?: string) {
  const db = supabaseAdmin();
  let q = db
    .from('invoices')
    .select(
      'id, number, organization_id, status, total_paise, paid_paise, due_at, period_start, org:organizations(name)',
    )
    .neq('status', 'draft')
    .order('issued_at', { ascending: false })
    .limit(300);
  if (status === 'issued' || status === 'paid' || status === 'void') q = q.eq('status', status);
  const [{ data: invoices }, { data: payments }, due] = await Promise.all([
    q,
    db
      .from('billing_payments')
      .select(
        'id, invoice_id, amount_paise, utr, method, paid_on, submitted_at, org:organizations(name), invoice:invoices(number, total_paise)',
      )
      .eq('status', 'submitted')
      .order('submitted_at'),
    dueOrganisations(),
  ]);
  const now = Date.now();
  return {
    invoices: (invoices ?? []).map((i) => ({
      id: i.id,
      number: i.number,
      orgId: i.organization_id,
      orgName: i.org?.name ?? '—',
      status: i.status,
      totalPaise: i.total_paise,
      paidPaise: i.paid_paise,
      dueAt: i.due_at,
      periodStart: i.period_start,
      overdue: i.status === 'issued' && !!i.due_at && new Date(i.due_at).getTime() < now,
    })) as ConsoleInvoice[],
    pending: (payments ?? []).map((p) => ({
      id: p.id,
      invoiceId: p.invoice_id,
      invoiceNumber: p.invoice?.number ?? null,
      orgName: p.org?.name ?? '—',
      amountPaise: p.amount_paise,
      utr: p.utr,
      method: p.method,
      paidOn: p.paid_on,
      submittedAt: p.submitted_at,
      invoiceTotal: p.invoice?.total_paise ?? 0,
    })) as PendingPayment[],
    dueCount: due.length,
  };
}
