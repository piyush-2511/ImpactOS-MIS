/**
 * Pure billing arithmetic (unit-tested). All amounts in paise. Dates are ISO yyyy-mm-dd calendar days (IST).
 */
const DAY = 86_400_000;
const d = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
export const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Inclusive day count between two ISO dates. */
export function daysInclusive(start: string, end: string): number {
  return Math.round((d(end) - d(start)) / DAY) + 1;
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function monthEnd(iso: string): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return toIso(Date.UTC(y, m, 0));
}

/** Add whole months to a period start (1st of a month) → next period start. */
export function addMonths(iso: string, n: number): string {
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7)) - 1 + n;
  return toIso(Date.UTC(y + Math.floor(m / 12), ((m % 12) + 12) % 12, 1));
}

/** The billing period that starts on `start` (monthly: to month end; annual: 12 months). */
export function periodFrom(start: string, period: 'monthly' | 'annual'): { start: string; end: string } {
  if (period === 'monthly') return { start, end: monthEnd(start) };
  return { start, end: toIso(d(addMonths(monthStart(start), 12)) - DAY) };
}

/** Amount for the days from `from` to the period end (inclusive), rounded to the nearest paisa. */
export function prorate(amount: number, periodStart: string, periodEnd: string, from: string): number {
  if (d(from) > d(periodEnd)) return 0;
  const start = d(from) < d(periodStart) ? periodStart : from;
  return Math.round((amount * daysInclusive(start, periodEnd)) / daysInclusive(periodStart, periodEnd));
}

/** Charge for upgrading mid-period: difference between the new and old price for the remaining days (never negative). */
export function upgradeCharge(
  oldPrice: number,
  newPrice: number,
  periodStart: string,
  periodEnd: string,
  changeDate: string,
): number {
  return Math.max(
    0,
    prorate(newPrice, periodStart, periodEnd, changeDate) - prorate(oldPrice, periodStart, periodEnd, changeDate),
  );
}

/** GST on a taxable amount, half-up to the paisa. bps: 1800 = 18%. */
export const gstOn = (taxable: number, bps: number) => Math.round((taxable * bps) / 10_000);

export type Line = {
  kind: 'plan' | 'extra_seats' | 'proration' | 'ai_pack' | 'donation_fee' | 'storage_pack' | 'manual' | 'credit';
  description: string;
  quantity: number;
  unit: number;
  amount: number;
};

/**
 * Lines and totals for one invoice: plan (prorated when the period starts mid-way), seats over the plan limit,
 * unbilled usage, then credits (never more than the subtotal), then GST on the remainder.
 */
export function buildInvoice(input: {
  planName: string;
  planPrice: number;
  extraSeatPrice: number;
  period: 'monthly' | 'annual';
  periodStart: string;
  periodEnd: string;
  billFrom?: string;
  seatsUsed: number;
  seatLimit: number | null;
  usage: { kind: Line['kind']; description: string; quantity: number; amount: number }[];
  credits: { id: string; amount: number }[];
  gstRateBps: number;
  labels: { plan: (name: string, start: string, end: string) => string; seats: (n: number) => string; credit: string };
}) {
  const lines: Line[] = [];
  const planAmount = input.billFrom
    ? prorate(input.planPrice, input.periodStart, input.periodEnd, input.billFrom)
    : input.planPrice;
  lines.push({
    kind: 'plan',
    description: input.labels.plan(input.planName, input.billFrom ?? input.periodStart, input.periodEnd),
    quantity: 1,
    unit: planAmount,
    amount: planAmount,
  });
  const extra = input.seatLimit === null ? 0 : Math.max(0, input.seatsUsed - input.seatLimit);
  if (extra > 0 && input.extraSeatPrice > 0) {
    const months = input.period === 'annual' ? 12 : 1;
    lines.push({
      kind: 'extra_seats',
      description: input.labels.seats(extra),
      quantity: extra,
      unit: input.extraSeatPrice * months,
      amount: extra * input.extraSeatPrice * months,
    });
  }
  for (const u of input.usage)
    lines.push({
      kind: u.kind,
      description: u.description,
      quantity: u.quantity,
      unit: u.quantity ? Math.round(u.amount / u.quantity) : u.amount,
      amount: u.amount,
    });
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  let remaining = subtotal;
  const applied: { id: string; amount: number }[] = [];
  for (const c of input.credits) {
    if (remaining <= 0) break;
    const use = Math.min(c.amount, remaining);
    applied.push({ id: c.id, amount: use });
    remaining -= use;
  }
  const credit = subtotal - remaining;
  if (credit > 0)
    lines.push({ kind: 'credit', description: input.labels.credit, quantity: 1, unit: -credit, amount: -credit });
  const gst = gstOn(remaining, input.gstRateBps);
  return { lines, subtotal, credit, gst, total: remaining + gst, appliedCredits: applied };
}
