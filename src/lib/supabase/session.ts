import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';
import type { Database } from './database.types';

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] };

/**
 * Refreshes the Supabase session (called from proxy.ts) BEFORE the proxy builds its response, so rewrites are kept.
 * Updated cookies are written onto the incoming request (so Server Components see the fresh token) and returned
 * for the caller to copy onto its response with `applyCookies`. Nothing else may run between client creation and
 * getClaims(): extra logic there causes random sign-outs.
 */
export async function refreshSession(request: NextRequest): Promise<{ cookies: CookieToSet[]; userId: string | null }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { cookies: [], userId: null };
  const pending: CookieToSet[] = [];
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const c of list) {
          request.cookies.set(c.name, c.value);
          pending.push(c);
        }
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  return { cookies: pending, userId: (data?.claims?.sub as string | undefined) ?? null };
}

export function applyCookies(response: NextResponse, cookies: CookieToSet[]): NextResponse {
  for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
  return response;
}
