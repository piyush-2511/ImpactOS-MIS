import 'server-only';
import { cache } from 'react';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { supabaseServer } from '@/lib/supabase/server';

export type FlagRow = {
  id: string;
  key: string;
  orgId: string | null;
  orgName: string | null;
  enabled: boolean;
  note: string | null;
  updatedAt: string;
};

export async function listFlags(): Promise<FlagRow[]> {
  const { data } = await supabaseAdmin().from('feature_flags').select('*, org:organizations(name)').order('key');
  return (data ?? []).map((f) => ({
    id: f.id,
    key: f.key,
    orgId: f.organization_id,
    orgName: f.org?.name ?? null,
    enabled: f.enabled,
    note: f.note,
    updatedAt: f.updated_at,
  }));
}

/** Is a feature on for this organisation? An organisation override wins over the global value; default off. */
export const flagEnabled = cache(async (orgId: string, key: string): Promise<boolean> => {
  const supabase = await supabaseServer();
  const { data } = await supabase.from('feature_flags').select('organization_id, enabled').eq('key', key);
  const own = (data ?? []).find((f) => f.organization_id === orgId);
  return own ? own.enabled : ((data ?? []).find((f) => f.organization_id === null)?.enabled ?? false);
});
