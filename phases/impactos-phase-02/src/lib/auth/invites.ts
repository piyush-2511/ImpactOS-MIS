/**
 * Invitation tokens: 32 random bytes (base64url) emailed to the invitee; only the SHA-256 hex digest is stored.
 * Pure functions, usable on server and in tests.
 */
export const INVITE_TTL_DAYS = 7;

export function generateInviteToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString('base64url');
}

export async function hashInviteToken(token: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error('Malformed invitation token');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Buffer.from(digest).toString('hex');
}

export function inviteExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export function isInviteExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function inviteUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, '')}/invite/${token}`;
}
