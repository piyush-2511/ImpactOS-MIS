import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Logged reveal of a sensitive field (full Aadhaar, bank account, salary, medical). Returns true only when the user
 * holds the pii.* permission; the database writes the audit entry in the same call. Callers fetch the unmasked value
 * only after this returns true.
 */
export async function revealField(opts: {
  orgId: string;
  permission: `pii.${string}`;
  table: string;
  rowId: string;
  field: string;
}): Promise<boolean> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('log_reveal', {
    p_org: opts.orgId,
    p_permission: opts.permission,
    p_table: opts.table,
    p_row: opts.rowId,
    p_field: opts.field,
  });
  return !error && data === true;
}

/** XXXX-XXXX-4821 style masking for display. */
export function maskTail(value: string | null | undefined, visible = 4): string {
  if (!value) return '—';
  const clean = value.replace(/\s|-/g, '');
  return clean.length <= visible
    ? clean
    : `${'X'.repeat(clean.length - visible)}${clean.slice(-visible)}`.replace(/(.{4})(?=.)/g, '$1-');
}
