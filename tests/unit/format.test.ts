import { describe, expect, it } from 'vitest';
import { financialYear, formatCompactINR, formatDate, formatDateNumeric, formatINR, formatNumber } from '@/lib/i18n/format';

describe('Indian number formatting', () => {
  it('uses lakh and crore grouping', () => {
    expect(formatNumber(1284000)).toBe('12,84,000');
    expect(formatINR(125000)).toBe('₹1,25,000');
  });
  it('keeps Western digits in Hindi', () => {
    expect(formatINR(125000, 'hi')).toMatch(/1,25,000/);
  });
  it('shows paise only when asked', () => {
    expect(formatINR(1999.5, 'en', { paise: true })).toBe('₹1,999.50');
  });
  it('compacts large amounts for dashboards', () => {
    expect(formatCompactINR(1840000)).toBe('₹18.4 L');
    expect(formatCompactINR(21000000)).toBe('₹2.1 Cr');
    expect(formatCompactINR(45000)).toBe('₹45,000');
    expect(formatCompactINR(1840000, 'hi')).toBe('₹18.4 लाख');
  });
});

describe('dates in IST', () => {
  it('formats in Asia/Kolkata regardless of server time zone', () => {
    // 18:45 UTC on 18 Oct is 00:15 IST on 19 Oct.
    expect(formatDateNumeric('2026-10-18T18:45:00Z')).toBe('19/10/2026');
    expect(formatDate('2026-10-19T06:00:00Z')).toBe('19 Oct 2026');
  });
});

describe('financial year (April–March)', () => {
  it.each([
    ['2026-10-15T00:00:00+05:30', '2026-27'],
    ['2026-04-01T00:00:00+05:30', '2026-27'],
    ['2026-03-31T23:59:00+05:30', '2025-26'],
    ['2099-12-01T00:00:00+05:30', '2099-00'],
  ])('%s → %s', (date, fy) => {
    expect(financialYear(date)).toBe(fy);
  });
});
