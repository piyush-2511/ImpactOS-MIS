'use client';

import { createBrowserClient } from '@supabase/ssr';
import { publicEnv } from '@/config/env';
import type { Database } from './database.types';

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Browser client for client-only auth calls (MFA enrolment, Google sign-in). Data writes go through server actions. */
export function supabaseBrowser() {
  if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  client ??= createBrowserClient<Database>(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return client;
}
