import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Application-level audit entry for events that are not a single row change (an invitation email sent, an HR password
 * reset, an export). Row changes are audited automatically by the audit_row_change() trigger.
 */
export async function audit(
  orgId: string,
  action: string,
  details: { table?: string; rowId?: string; note?: string; after?: Record<string, unknown> } = {},
) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc('record_audit', {
    p_org: orgId,
    p_action: action,
    p_table: details.table ?? null,
    p_row: details.rowId ?? null,
    p_note: details.note ?? null,
    p_after: (details.after as never) ?? null,
  });
  if (error) console.error('[audit] record failed', error.code);
}
