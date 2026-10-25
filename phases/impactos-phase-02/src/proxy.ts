import { NextResponse, type NextRequest } from 'next/server';
import { parseHost, type ParsedHost } from '@/config/hosts';
import { applyCookies, refreshSession } from '@/lib/supabase/session';

/**
 * Host routing + session refresh (Next.js 16 `proxy`). One deployment serves every host:
 *  - theimpactos.in → marketing site; auth/workspace paths redirect to the app host
 *  - app.theimpactos.in → sign-in screens, workspace ("/" is served by (app)/home), /me (phase 12)
 *  - console.theimpactos.in → /console only (+ MFA and auth APIs); 30-min idle and 8-hour absolute timeout
 *  - NGONAME.theimpactos.in → rewritten to /o/NGONAME (public pages, phase 9); /login goes to the app host
 */
const AUTH_PATHS = ['/login', '/signup', '/verify', '/setup-org', '/forgot-password', '/reset-password', '/change-password', '/mfa', '/invite'];
const APP_PATHS = ['/home', '/account', '/program', '/media', '/marketing', '/fundraising', '/hr', '/organisation', '/governance', '/compliance', '/workplace', '/admin', '/assistant', '/finance', '/me'];
const SITE_ONLY = ['/pricing'];
const CONSOLE_IDLE_MS = 30 * 60 * 1000;
const CONSOLE_MAX_MS = 8 * 60 * 60 * 1000;

const under = (path: string, list: string[]) => list.some((p) => path === p || path.startsWith(`${p}/`));

function hostUrl(request: NextRequest, sub: 'app' | 'console' | null, rootDomain: string, path: string) {
  // Plain URL (not NextURL, which rewrites "localhost" hosts); rootDomain may include a port in development.
  return new URL(path, `${request.nextUrl.protocol}//${sub ? `${sub}.` : ''}${rootDomain}`);
}

function withHeaders(request: NextRequest, parsed: ParsedHost) {
  const headers = new Headers(request.headers);
  headers.set('x-impactos-host', parsed.kind);
  headers.set('x-impactos-path', request.nextUrl.pathname + request.nextUrl.search);
  if (parsed.slug) headers.set('x-impactos-org', parsed.slug);
  else headers.delete('x-impactos-org');
  return headers;
}

export async function proxy(request: NextRequest) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';
  const parsed = parseHost(request.headers.get('host'), rootDomain);
  const path = request.nextUrl.pathname;
  const search = request.nextUrl.search;

  if (parsed.kind === 'reserved') return new NextResponse(null, { status: 404 });

  // ── NGO public subdomain ───────────────────────────────
  if (parsed.kind === 'public' && parsed.slug) {
    if (path === '/login') return NextResponse.redirect(hostUrl(request, 'app', rootDomain, `/login?org=${parsed.slug}`));
    const url = request.nextUrl.clone();
    url.pathname = `/o/${parsed.slug}${path === '/' ? '' : path}`;
    return NextResponse.rewrite(url, { request: { headers: withHeaders(request, parsed) } });
  }

  // ── Marketing site ─────────────────────────────────────
  if (parsed.kind === 'site') {
    if (under(path, AUTH_PATHS) || under(path, APP_PATHS) || under(path, ['/console', '/api/auth'])) {
      return NextResponse.redirect(hostUrl(request, 'app', rootDomain, path + search));
    }
    return NextResponse.next({ request: { headers: withHeaders(request, parsed) } });
  }

  // ── Platform console ───────────────────────────────────
  if (parsed.kind === 'console') {
    if (path === '/') return NextResponse.redirect(new URL('/console', request.url));
    if (!under(path, ['/console', '/mfa', '/api/auth'])) return new NextResponse(null, { status: 404 });
    const { cookies, userId } = await refreshSession(request);
    const response = applyCookies(NextResponse.next({ request: { headers: withHeaders(request, parsed) } }), cookies);
    if (userId && path !== '/console/login') {
      const now = Date.now();
      const start = Number(request.cookies.get('ios_console_start')?.value ?? 0);
      const seen = Number(request.cookies.get('ios_console_seen')?.value ?? 0);
      if (!start || now - start > CONSOLE_MAX_MS || now - seen > CONSOLE_IDLE_MS) {
        const out = NextResponse.redirect(new URL(`/console/login?expired=1&next=${encodeURIComponent(path)}`, request.url));
        for (const c of request.cookies.getAll()) if (c.name.startsWith('sb-') || c.name.startsWith('ios_console_')) out.cookies.delete(c.name);
        return out;
      }
      response.cookies.set('ios_console_seen', String(now), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/' });
    }
    return response;
  }

  // ── Workspace (app host) ───────────────────────────────
  if (under(path, ['/console', '/o'])) return new NextResponse(null, { status: 404 });
  if (under(path, SITE_ONLY)) return NextResponse.redirect(hostUrl(request, null, rootDomain, path + search));
  if (path === '/api/auth/email-hook') return NextResponse.next({ request: { headers: withHeaders(request, parsed) } });
  // Refresh first: it updates the request cookies, which withHeaders() then forwards.
  const { cookies } = await refreshSession(request);
  const headers = withHeaders(request, parsed);
  if (path === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/home';
    return applyCookies(NextResponse.rewrite(url, { request: { headers } }), cookies);
  }
  return applyCookies(NextResponse.next({ request: { headers } }), cookies);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/health|monitoring|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)'],
};
