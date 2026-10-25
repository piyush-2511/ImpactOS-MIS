import 'server-only';
import { createElement } from 'react';
import QRCode from 'qrcode';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { financialYear, formatDate } from '@/lib/i18n/format';
import { renderPdf } from '@/lib/pdf/render';
import { InvoicePdf } from '@/lib/pdf/templates/Invoice';
import { defaultStorage, objectKey } from '@/lib/storage';
import { sendEmail } from '@/lib/email/send';
import { InvoiceIssued, invoiceIssuedSubject } from '@/lib/email/templates/InvoiceIssued';
import { notify } from '@/lib/notifications/notify';
import { formatPaise } from './plans';
import { buildInvoice, monthStart, periodFrom, toIso } from './proration';
import { DUE_DAYS } from './read-only';

/** Who gets paid (ImpactOS). From environment so bank details are never in the code. */
export function platformPayee() {
  return {
    name: process.env.PLATFORM_LEGAL_NAME || 'ImpactOS',
    address: process.env.PLATFORM_ADDRESS || '',
    gstin: process.env.PLATFORM_GSTIN || undefined,
    upi: process.env.PLATFORM_UPI_ID || undefined,
    bankName: process.env.PLATFORM_BANK_NAME || undefined,
    account: process.env.PLATFORM_BANK_ACCOUNT || undefined,
    ifsc: process.env.PLATFORM_BANK_IFSC || undefined,
  };
}
export const gstRateBps = () => Number(process.env.BILLING_GST_RATE_BPS ?? 0);

/** UPI payment link (opened by phone UPI apps or encoded in the QR). */
export function upiLink(amountPaise: number, reference: string): string | null {
  const p = platformPayee();
  if (!p.upi) return null;
  const q = new URLSearchParams({
    pa: p.upi,
    pn: p.name,
    am: (amountPaise / 100).toFixed(2),
    cu: 'INR',
    tn: reference,
  });
  return `upi://pay?${q.toString()}`;
}

const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const LABELS = {
  en: {
    invoice: 'Invoice',
    billTo: 'Bill to',
    number: 'Invoice no.',
    issued: 'Date',
    due: 'Due',
    period: 'Period',
    item: 'Item',
    qty: 'Qty',
    amount: 'Amount',
    subtotal: 'Subtotal',
    credit: 'Credit',
    total: 'Total',
    pay: 'How to pay',
    upi: 'UPI',
    bank: 'Bank transfer',
    reference: 'Reference',
    fc: 'Please pay from domestic (non-FC) funds.',
    utr: 'After paying, enter the UTR in ImpactOS → Admin → Billing.',
  },
  hi: {
    invoice: 'चालान',
    billTo: 'प्राप्तकर्ता',
    number: 'चालान सं.',
    issued: 'तारीख',
    due: 'अंतिम तारीख',
    period: 'अवधि',
    item: 'विवरण',
    qty: 'मात्रा',
    amount: 'राशि',
    subtotal: 'उप-योग',
    credit: 'क्रेडिट',
    total: 'कुल',
    pay: 'भुगतान कैसे करें',
    upi: 'UPI',
    bank: 'बैंक ट्रांसफ़र',
    reference: 'संदर्भ',
    fc: 'कृपया घरेलू (गैर-FC) निधि से भुगतान करें।',
    utr: 'भुगतान के बाद ImpactOS → एडमिन → बिलिंग में UTR डालें।',
  },
} as const;

/**
 * Issue the next invoice for one organisation if its period has ended (or its trial ended). Idempotent: one invoice
 * per organisation per period start (unique index). Returns the invoice id, or null when nothing is due.
 */
export async function issueDueInvoice(orgId: string, today = todayIst()): Promise<string | null> {
  const db = supabaseAdmin();
  const { data: sub } = await db.from('subscriptions').select('*').eq('organization_id', orgId).single();
  if (!sub || sub.status === 'cancelled') return null;

  let periodStart: string;
  let billFrom: string | undefined;
  let planKey = sub.plan_key;
  let period = sub.billing_period;
  if (sub.status === 'trialing') {
    if (!sub.trial_ends_at || toIso(new Date(sub.trial_ends_at).getTime()) > today) return null;
    // First paid period: from the trial end to the month end (prorated); then regular periods from the 1st.
    periodStart = monthStart(toIso(new Date(sub.trial_ends_at).getTime()));
    billFrom = toIso(new Date(sub.trial_ends_at).getTime());
    period = 'monthly';
  } else {
    if (sub.current_period_end && sub.current_period_end >= today) return null;
    periodStart = sub.current_period_end
      ? toIso(new Date(`${sub.current_period_end}T00:00:00Z`).getTime() + 86_400_000)
      : monthStart(today);
    if (sub.pending_plan_key) planKey = sub.pending_plan_key;
  }
  const { start, end } = periodFrom(periodStart, period);

  const [{ data: plan }, { data: seatLimit }, { data: seats }, { data: usage }, { data: credits }, { data: org }] =
    await Promise.all([
      db.from('plans').select('*').eq('key', planKey).single(),
      db.from('plan_limits').select('value').eq('plan_key', planKey).eq('limit_key', 'staff_seats').maybeSingle(),
      db.rpc('staff_seats_used', { org: orgId }),
      db.from('usage_records').select('*').eq('organization_id', orgId).is('invoice_id', null),
      db.from('credit_notes').select('id, amount_paise').eq('organization_id', orgId).is('applied_invoice_id', null),
      db.from('organizations').select('name, state, pan, locale').eq('id', orgId).single(),
    ]);
  if (!plan || !org) throw new Error('plan or organisation missing');
  const locale = org.locale;
  const built = buildInvoice({
    planName: plan.name,
    planPrice: period === 'annual' ? plan.annual_paise : plan.monthly_paise,
    extraSeatPrice: plan.extra_seat_paise,
    period,
    periodStart: start,
    periodEnd: end,
    billFrom,
    seatsUsed: seats ?? 0,
    seatLimit: seatLimit?.value ?? null,
    usage: (usage ?? []).map((u) => ({
      kind: u.kind,
      description: u.description,
      quantity: Number(u.quantity),
      amount: u.amount_paise,
    })),
    credits: (credits ?? []).map((c) => ({ id: c.id, amount: c.amount_paise })),
    gstRateBps: gstRateBps(),
    labels: {
      plan: (n, a, b) =>
        locale === 'hi'
          ? `${n} योजना, ${formatDate(a, 'hi')} – ${formatDate(b, 'hi')}`
          : `${n} plan, ${formatDate(a)} – ${formatDate(b)}`,
      seats: (n) => (locale === 'hi' ? `अतिरिक्त स्टाफ़ सीटें (${n})` : `Extra staff seats (${n})`),
      credit: locale === 'hi' ? 'क्रेडिट नोट' : 'Credit note',
    },
  });

  const { data: draft, error } = await db
    .from('invoices')
    .insert({
      organization_id: orgId,
      status: 'draft',
      period_start: start,
      period_end: end,
      plan_key: planKey,
      subtotal_paise: built.subtotal,
      credit_paise: built.credit,
      gst_rate_bps: gstRateBps(),
      gst_paise: built.gst,
      total_paise: built.total,
    })
    .select('id')
    .single();
  if (error?.code === '23505') return null; // already issued for this period
  if (error || !draft) throw error ?? new Error('invoice insert failed');
  await db
    .from('invoice_lines')
    .insert(
      built.lines.map((l, i) => ({
        invoice_id: draft.id,
        kind: l.kind,
        description: l.description,
        quantity: l.quantity,
        unit_paise: l.unit,
        amount_paise: l.amount,
        sort_order: i,
      })),
    );

  const fy = financialYear(today);
  const { data: number } = await db.rpc('next_platform_number', {
    p_key: 'invoice',
    p_period: fy,
    p_prefix: `IOS/${fy}/`,
  });
  const issuedAt = new Date();
  const dueAt = new Date(issuedAt.getTime() + DUE_DAYS * 86_400_000);
  await db
    .from('invoices')
    .update({ status: 'issued', number, issued_at: issuedAt.toISOString(), due_at: dueAt.toISOString() })
    .eq('id', draft.id);
  if (built.appliedCredits.length)
    for (const c of built.appliedCredits)
      await db.from('credit_notes').update({ applied_invoice_id: draft.id }).eq('id', c.id);
  if (usage?.length)
    await db
      .from('usage_records')
      .update({ invoice_id: draft.id })
      .in(
        'id',
        usage.map((u) => u.id),
      );
  await db
    .from('subscriptions')
    .update({
      status: sub.status === 'trialing' ? 'active' : sub.status,
      plan_key: planKey,
      billing_period: period,
      pending_plan_key: null,
      current_period_start: start,
      current_period_end: end,
    })
    .eq('organization_id', orgId);

  // PDF with UPI QR for the exact amount; stored like any generated file.
  const link = upiLink(built.total, number ?? '');
  const qr = link ? await QRCode.toDataURL(link, { margin: 1, width: 220 }) : null;
  const L = LABELS[locale];
  const bytes = await renderPdf(
    createElement(InvoicePdf, {
      locale,
      payee: platformPayee(),
      billTo: { name: org.name, state: org.state, pan: org.pan },
      number: number ?? '',
      issued: formatDate(issuedAt, locale),
      due: formatDate(dueAt, locale),
      period: `${formatDate(start, locale)} – ${formatDate(end, locale)}`,
      lines: built.lines.map((l) => ({
        description: l.description,
        quantity: l.quantity,
        amount: formatPaise(l.amount, locale),
      })),
      subtotal: formatPaise(built.subtotal, locale),
      credit: built.credit ? formatPaise(-built.credit, locale) : null,
      gst: built.gst ? formatPaise(built.gst, locale) : null,
      gstLabel: `GST ${gstRateBps() / 100}%`,
      total: formatPaise(built.total, locale),
      qrDataUrl: qr,
      labels: L,
    }),
  );
  const storage = defaultStorage();
  const fileId = crypto.randomUUID();
  const key = objectKey(orgId, 'generated', fileId, `${(number ?? 'invoice').replaceAll('/', '-')}.pdf`);
  await storage.put(key, bytes, 'application/pdf');
  const { data: file } = await db
    .from('storage_files')
    .insert({
      organization_id: orgId,
      provider: storage.kind,
      object_key: key,
      name: `${(number ?? 'invoice').replaceAll('/', '-')}.pdf`,
      mime: 'application/pdf',
      size_bytes: bytes.byteLength,
      purpose: 'generated',
      entity: 'invoices',
      entity_id: draft.id,
    })
    .select('id')
    .single();
  if (file) {
    await db.from('storage_files').update({ status: 'ready' }).eq('id', file.id);
    await db.from('invoices').update({ pdf_file_id: file.id }).eq('id', draft.id);
  }

  // Tell the Secretaries (email + in-app).
  const { data: secs } = await db
    .from('organization_members')
    .select('user_id, profile:profiles!organization_members_profile_fkey(email, locale)')
    .eq('organization_id', orgId)
    .eq('status', 'active')
    .eq('base_role', 'secretary');
  const url = `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/admin/billing`;
  for (const s of secs ?? []) {
    const l = (s.profile?.locale ?? locale) as 'en' | 'hi';
    if (s.profile?.email)
      await sendEmail({
        to: s.profile.email,
        subject: invoiceIssuedSubject(l, number ?? ''),
        react: createElement(InvoiceIssued, {
          locale: l,
          org: org.name,
          amount: formatPaise(built.total, l),
          due: formatDate(dueAt, l),
          url,
        }),
        tags: { kind: 'invoice' },
      });
  }
  await notify({
    orgId,
    userIds: (secs ?? []).map((s) => s.user_id),
    kind: 'billing.invoice',
    title: `Invoice ${number}: ${formatPaise(built.total)}`,
    link: '/admin/billing',
  });
  return draft.id;
}

/** Monthly run (1st, 06:00 IST) and daily trial conversions: every organisation with a period or trial that has ended. */
export async function dueOrganisations(today = todayIst()): Promise<string[]> {
  const db = supabaseAdmin();
  const [{ data: periods }, { data: trials }] = await Promise.all([
    db
      .from('subscriptions')
      .select('organization_id')
      .in('status', ['active', 'past_due', 'read_only'])
      .lt('current_period_end', today),
    db
      .from('subscriptions')
      .select('organization_id')
      .eq('status', 'trialing')
      .lte('trial_ends_at', new Date().toISOString()),
  ]);
  return [...new Set([...(periods ?? []), ...(trials ?? [])].map((r) => r.organization_id))];
}
