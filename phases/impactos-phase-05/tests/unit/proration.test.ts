import { describe, expect, it } from 'vitest';
import {
  addMonths,
  buildInvoice,
  daysInclusive,
  gstOn,
  monthEnd,
  periodFrom,
  prorate,
  upgradeCharge,
} from '@/lib/billing/proration';
import { reminderToSend, statusFromInvoices } from '@/lib/billing/read-only';
import { formatPaise, trialDaysLeft } from '@/lib/billing/plans';

const labels = {
  plan: (n: string, a: string, b: string) => `${n} ${a}–${b}`,
  seats: (n: number) => `Extra seats (${n})`,
  credit: 'Credit',
};

describe('calendar helpers', () => {
  it('counts days inclusively, including leap years', () => {
    expect(daysInclusive('2026-11-01', '2026-11-30')).toBe(30);
    expect(daysInclusive('2028-02-01', monthEnd('2028-02-10'))).toBe(29);
  });
  it('builds monthly and annual periods', () => {
    expect(periodFrom('2026-11-01', 'monthly')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(periodFrom('2026-11-01', 'annual')).toEqual({ start: '2026-11-01', end: '2027-10-31' });
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
  });
});

describe('proration', () => {
  it('charges the remaining days of a period', () => {
    expect(prorate(599900, '2026-11-01', '2026-11-30', '2026-11-16')).toBe(299950);
    expect(prorate(599900, '2026-11-01', '2026-11-30', '2026-11-01')).toBe(599900);
    expect(prorate(599900, '2026-11-01', '2026-11-30', '2026-12-01')).toBe(0);
  });
  it('charges only the difference on upgrade and never refunds on downgrade', () => {
    expect(upgradeCharge(199900, 599900, '2026-11-01', '2026-11-30', '2026-11-16')).toBe(200000);
    expect(upgradeCharge(599900, 199900, '2026-11-01', '2026-11-30', '2026-11-16')).toBe(0);
  });
  it('rounds GST to the paisa', () => {
    expect(gstOn(599900, 1800)).toBe(107982);
    expect(gstOn(599900, 0)).toBe(0);
  });
});

describe('buildInvoice', () => {
  const base = {
    planName: 'Growth',
    planPrice: 599900,
    extraSeatPrice: 39900,
    period: 'monthly' as const,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    seatsUsed: 15,
    seatLimit: 15,
    usage: [],
    credits: [],
    gstRateBps: 0,
    labels,
  };
  it('bills the plan for a full period', () => {
    const r = buildInvoice(base);
    expect(r.lines).toHaveLength(1);
    expect(r.total).toBe(599900);
  });
  it('prorates the first period after a trial', () => {
    expect(buildInvoice({ ...base, billFrom: '2026-11-16' }).total).toBe(299950);
  });
  it('adds seats above the plan limit and usage lines', () => {
    const r = buildInvoice({
      ...base,
      seatsUsed: 17,
      usage: [{ kind: 'donation_fee', description: 'Online donation fees', quantity: 12, amount: 4800 }],
    });
    expect(r.lines.map((l) => l.kind)).toEqual(['plan', 'extra_seats', 'donation_fee']);
    expect(r.subtotal).toBe(599900 + 2 * 39900 + 4800);
  });
  it('applies credits up to the subtotal (leftover credit stays for later) and taxes the remainder', () => {
    const r = buildInvoice({
      ...base,
      credits: [
        { id: 'a', amount: 100000 },
        { id: 'b', amount: 900000 },
      ],
      gstRateBps: 1800,
    });
    expect(r.credit).toBe(599900);
    expect(r.appliedCredits).toEqual([
      { id: 'a', amount: 100000 },
      { id: 'b', amount: 499900 },
    ]);
    expect(r.total).toBe(0);
    const partial = buildInvoice({ ...base, credits: [{ id: 'a', amount: 99900 }], gstRateBps: 1800 });
    expect(partial.total).toBe(500000 + 90000);
  });
  it('treats an unlimited seat plan as no extra seats', () => {
    expect(buildInvoice({ ...base, seatsUsed: 500, seatLimit: null }).lines).toHaveLength(1);
  });
});

describe('reminders and status', () => {
  const due = '2026-11-11T00:30:00Z';
  const at = (iso: string) => new Date(iso);
  it('sends each reminder once, in order', () => {
    expect(reminderToSend({ due_at: due, reminders_sent: [] }, at('2026-11-03T05:00:00Z'))).toBeNull();
    expect(reminderToSend({ due_at: due, reminders_sent: [] }, at('2026-11-04T05:00:00Z'))).toBe('d-7');
    expect(reminderToSend({ due_at: due, reminders_sent: ['d-7'] }, at('2026-11-11T05:00:00Z'))).toBe('d0');
    expect(reminderToSend({ due_at: due, reminders_sent: ['d-7', 'd0'] }, at('2026-11-12T05:00:00Z'))).toBeNull();
    expect(reminderToSend({ due_at: due, reminders_sent: ['d-7', 'd0', 'd+7'] }, at('2026-11-25T05:00:00Z'))).toBe(
      'd+14',
    );
  });
  it('moves to past due after the due date and read-only after 15 days of grace', () => {
    expect(statusFromInvoices('active', due, at('2026-11-10T05:00:00Z'))).toBe('active');
    expect(statusFromInvoices('active', due, at('2026-11-13T05:00:00Z'))).toBe('past_due');
    expect(statusFromInvoices('past_due', due, at('2026-11-27T05:00:00Z'))).toBe('read_only');
    expect(statusFromInvoices('read_only', null)).toBe('active');
  });
  it('never touches trials or cancelled subscriptions', () => {
    expect(statusFromInvoices('trialing', due, at('2027-01-01T00:00:00Z'))).toBe('trialing');
    expect(statusFromInvoices('cancelled', null)).toBe('cancelled');
  });
});

describe('display helpers', () => {
  it('formats paise as rupees with Indian grouping', () => {
    expect(formatPaise(599900)).toBe('₹5,999');
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
  });
  it('counts trial days left', () => {
    expect(trialDaysLeft(new Date(Date.now() + 2.5 * 86_400_000).toISOString())).toBe(3);
    expect(trialDaysLeft(null)).toBe(0);
  });
});
