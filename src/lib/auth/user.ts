import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/supabase/database.types';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * The signed-in user, verified with Supabase Auth (getUser contacts the auth server; never trust getSession on
 * the server). Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await supabaseServer();
  const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  return data;
});

/** Use at the top of every protected Server Component, action and route handler. */
export async function requireUser(next?: string): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`);
  return user;
}

/** Only allow relative, same-site redirect targets (prevents open redirects through ?next=). */
export function safeNext(next: string | null | undefined, fallback = '/'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
