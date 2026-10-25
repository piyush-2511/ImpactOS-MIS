import { NextResponse, type NextRequest } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/user';
import { limit } from '@/lib/auth/ratelimit';
import { isValidSlug } from '@/config/hosts';

/** Live subdomain availability for organisation setup. Signed-in users only. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const rl = await limit('slugCheck', user.id);
  if (!rl.ok) return NextResponse.json({ error: 'rateLimited' }, { status: 429 });
  const slug = (request.nextUrl.searchParams.get('slug') ?? '').trim().toLowerCase();
  if (!isValidSlug(slug)) return NextResponse.json({ valid: false, available: false });
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc('slug_available', { p_slug: slug });
  if (error) return NextResponse.json({ error: 'failed' }, { status: 500 });
  return NextResponse.json({ valid: true, available: !!data }, { headers: { 'Cache-Control': 'no-store' } });
}
