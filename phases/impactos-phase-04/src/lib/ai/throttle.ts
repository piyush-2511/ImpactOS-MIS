import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** Monthly AI units per organisation. Phase 5 reads the allowance from the plan; until then the env default applies. */
export const DEFAULT_MONTHLY_UNITS = Number(process.env.AI_MONTHLY_UNITS ?? 5000);

/** Atomically reserve units; false when the month's allowance would be exceeded (nothing is consumed then). */
export async function consumeUnits(orgId: string, units: number, allowance = DEFAULT_MONTHLY_UNITS): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc('ai_consume', {
    p_org: orgId,
    p_units: Math.max(1, Math.ceil(units)),
    p_allowance: allowance,
  });
  return !error && data === true;
}
