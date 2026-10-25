import 'server-only';
import type { Json } from '@/lib/supabase/database.types';
import { supabaseAdmin } from '@/lib/supabase/admin';

/** sha256(purpose, system prompt, redacted input): identical requests reuse the stored answer. */
export async function inputHash(purpose: string, system: string, input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${purpose}\u0000${system}\u0000${input}`),
  );
  return Buffer.from(digest).toString('hex');
}

export async function cachedRun(orgId: string, purpose: string, hash: string): Promise<unknown | null> {
  const { data } = await supabaseAdmin()
    .from('ai_runs')
    .select('output')
    .eq('organization_id', orgId)
    .eq('purpose', purpose)
    .eq('input_hash', hash)
    .maybeSingle();
  return data?.output ?? null;
}

export async function saveRun(r: {
  orgId: string;
  purpose: string;
  hash: string;
  model: string;
  output: unknown;
  units: number;
  userId?: string;
}) {
  await supabaseAdmin()
    .from('ai_runs')
    .upsert(
      {
        organization_id: r.orgId,
        purpose: r.purpose,
        input_hash: r.hash,
        model: r.model,
        output: r.output as Json,
        units: r.units,
        created_by: r.userId ?? null,
      },
      { onConflict: 'organization_id,purpose,input_hash', ignoreDuplicates: true },
    );
}
