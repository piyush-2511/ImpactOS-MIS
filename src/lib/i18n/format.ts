/**
 * Indian formatting helpers. Amounts use lakh/crore grouping; dates are shown in IST; the financial year runs April–March.
 * Digits stay Western (1, 2, 3) in both English and Hindi unless a caller asks otherwise.
 */
import type { Locale } from './config';

const TZ = 'Asia/Kolkata';
const tag = (locale: Locale) => (locale === 'hi' ? 'hi-IN-u-nu-latn' : 'en-IN');

/** ₹1,25,000 — whole rupees by default. */
export function formatINR(amount: number, locale: Locale = 'en', opts: { paise?: boolean } = {}): string {
  return new Intl.NumberFormat(tag(locale), {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: opts.paise ? 2 : 0,
    maximumFractionDigits: opts.paise ? 2 : 0,
  }).format(amount);
}

/** 12,84,000 — Indian grouping without the currency sign. */
export function formatNumber(n: number, locale: Locale = 'en'): string {
  return new Intl.NumberFormat(tag(locale)).format(n);
}

/** Short amounts for dashboards: ₹18.4 L, ₹2.1 Cr, ₹45,000. */
export function formatCompactINR(amount: number, locale: Locale = 'en'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  const one = (v: number) => (Math.round(v * 10) / 10).toString();
  if (abs >= 1e7) return `${sign}₹${one(abs / 1e7)} ${locale === 'hi' ? 'करोड़' : 'Cr'}`;
  if (abs >= 1e5) return `${sign}₹${one(abs / 1e5)} ${locale === 'hi' ? 'लाख' : 'L'}`;
  return `${sign}${formatINR(abs, locale)}`;
}

/** 19 Oct 2026 (IST). */
export function formatDate(d: Date | string, locale: Locale = 'en'): string {
  return new Intl.DateTimeFormat(tag(locale), { day: '2-digit', month: 'short', year: 'numeric', timeZone: TZ }).format(new Date(d));
}

/** 19/10/2026 (IST) for tables and exports. */
export function formatDateNumeric(d: Date | string): string {
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }).format(new Date(d));
}

/** Indian financial year of a date: 15 Oct 2026 → "2026-27"; 15 Mar 2026 → "2025-26". */
export function financialYear(d: Date | string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: 'numeric', timeZone: TZ }).formatToParts(new Date(d));
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}
