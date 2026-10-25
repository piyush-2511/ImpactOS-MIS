import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';
import { financialYear } from '@/lib/i18n/format';

/**
 * Next gap-free number in a series (receipts, beneficiary IDs, asset codes). The database locks the row, so two
 * people saving at once never get the same number. Period defaults to the current Indian financial year.
 */
export async function nextNumber(
  orgId: string,
  series: string,
  opts: { period?: string; prefix?: string; pad?: number } = {},
): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('next_number', {
    p_org: orgId,
    p_series: series,
    p_period: opts.period ?? financialYear(new Date()),
    p_prefix: opts.prefix ?? '',
    p_pad: opts.pad ?? 5,
  });
  if (error || !data) throw error ?? new Error('next_number failed');
  return data;
}

/** "AF/{FY}/" style prefixes: replaces {FY} and {YYYY}. */
export function formatPrefix(pattern: string, date = new Date()): string {
  return pattern.replaceAll('{FY}', financialYear(date)).replaceAll('{YYYY}', String(date.getFullYear()));
}
