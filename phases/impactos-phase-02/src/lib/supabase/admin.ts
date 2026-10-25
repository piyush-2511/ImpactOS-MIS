import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { publicEnv, serverEnv } from '@/config/env';
import type { Database } from './database.types';

/**
 * Service-role client. BYPASSES RLS. Allowed only in: jobs, webhooks, provisioning (username accounts, invites),
 * auth event logging and console aggregates (hard rule 5). Never pass its results to the browser unfiltered.
 */
export function supabaseAdmin() {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !key) throw new Error('Supabase service role is not configured');
  return createClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
