/**
 * Signed active-organisation cookie: `<orgId>.<hmac>` (HMAC-SHA256, base64url). Web Crypto so it works in Node
 * and edge runtimes. The cookie only says which org the user last chose; membership is re-checked every request
 * and RLS never reads it.
 */
export const ORG_COOKIE = 'ios_org';
export const ORG_COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

const enc = new TextEncoder();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function b64url(bytes: ArrayBuffer): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(await crypto.subtle.sign('HMAC', key, enc.encode(value)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signOrgId(orgId: string, secret: string): Promise<string> {
  if (!UUID_RE.test(orgId)) throw new Error('Invalid organisation id');
  return `${orgId}.${await hmac(secret, orgId)}`;
}

export async function verifyOrgCookie(raw: string | undefined, secret: string): Promise<string | null> {
  if (!raw) return null;
  const dot = raw.indexOf('.');
  if (dot < 0) return null;
  const orgId = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!UUID_RE.test(orgId)) return null;
  return timingSafeEqual(sig, await hmac(secret, orgId)) ? orgId : null;
}
