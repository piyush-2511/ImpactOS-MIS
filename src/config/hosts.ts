/** Host routing rules shared by `src/proxy.ts` and server code. See references/deployment.md. */
export const RESERVED_SLUGS = [
  'www', 'app', 'api', 'console', 'admin', 'mail', 'staging', 'status', 'help', 'docs', 'blog', 'donate',
] as const;

export type HostKind = 'site' | 'app' | 'console' | 'public' | 'reserved';
export type ParsedHost = { kind: HostKind; slug?: string };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !(RESERVED_SLUGS as readonly string[]).includes(slug);
}

/**
 * Classify a request host against the root domain.
 * theimpactos.in → site · app.theimpactos.in → app · console.theimpactos.in → console ·
 * NGONAME.theimpactos.in → public (slug) · other reserved subdomains → reserved.
 * Local development: app.localhost:3000, console.localhost:3000, ngo.localhost:3000 work the same way.
 */
export function parseHost(rawHost: string | null, rootDomain: string): ParsedHost {
  const host = (rawHost ?? '').toLowerCase().replace(/\.$/, '');
  const root = rootDomain.toLowerCase();
  if (!host || host === root || host === `www.${root}`) return { kind: 'site' };
  if (!host.endsWith(`.${root}`)) return { kind: 'site' };
  const sub = host.slice(0, -(root.length + 1));
  if (sub.includes('.')) return { kind: 'reserved' };
  if (sub === 'app') return { kind: 'app' };
  if (sub === 'console') return { kind: 'console' };
  if ((RESERVED_SLUGS as readonly string[]).includes(sub)) return { kind: 'reserved' };
  return SLUG_RE.test(sub) ? { kind: 'public', slug: sub } : { kind: 'reserved' };
}
