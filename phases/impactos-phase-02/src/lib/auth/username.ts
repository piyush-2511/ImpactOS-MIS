/**
 * Username accounts for people without email (field workers, interns, volunteers).
 * Each gets a synthetic, non-routable auth email: <username>.<8 hex>@<SYNTHETIC_EMAIL_DOMAIN>.
 * The email layer refuses to send to these addresses (see lib/email/send.ts).
 */
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|\.(?!\.)){1,28}[a-z0-9]$/;
export const DEFAULT_SYNTHETIC_DOMAIN = 'users.id.theimpactos.in';

export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, '.');
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

export function syntheticEmail(username: string, domain = DEFAULT_SYNTHETIC_DOMAIN): string {
  if (!isValidUsername(username)) throw new Error('Invalid username');
  const suffix = Buffer.from(crypto.getRandomValues(new Uint8Array(4))).toString('hex');
  return `${username}.${suffix}@${domain}`;
}

export function isSyntheticEmail(email: string | null | undefined, domain = DEFAULT_SYNTHETIC_DOMAIN): boolean {
  if (!email) return false;
  const at = email.toLowerCase().lastIndexOf('@');
  return at > 0 && email.toLowerCase().slice(at + 1) === domain.toLowerCase();
}

/** Readable initial password for printed slips: no 0/O/1/l/I; 12 characters with at least one digit. */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generatePassword(length = 12): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    const pw = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
    if (/\d/.test(pw) && /[a-z]/.test(pw) && /[A-Z]/.test(pw)) return pw;
  }
}

/** Org code (slug) + username → lookup key for rate limiting. */
export function usernameLoginKey(orgSlug: string, username: string): string {
  return `ulogin:${orgSlug.toLowerCase()}:${normalizeUsername(username)}`;
}
