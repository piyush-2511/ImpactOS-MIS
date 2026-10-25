import { describe, expect, it } from 'vitest';
import { generateInviteToken, hashInviteToken, INVITE_TTL_DAYS, inviteExpiry, inviteUrl, isInviteExpired } from '@/lib/auth/invites';

describe('invitation tokens', () => {
  it('are 32 random bytes in base64url (43 characters) and unique', () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a).not.toBe(b);
  });

  it('are stored only as a SHA-256 hex digest that matches the database check', async () => {
    const token = generateInviteToken();
    const hash = await hashInviteToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashInviteToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it('matches an independent SHA-256 (same as Postgres digest())', async () => {
    const { createHash } = await import('node:crypto');
    const token = 'A'.repeat(43);
    expect(await hashInviteToken(token)).toBe(createHash('sha256').update(token).digest('hex'));
  });

  it('rejects malformed tokens before hashing', async () => {
    await expect(hashInviteToken('short')).rejects.toThrow();
    await expect(hashInviteToken('A'.repeat(42) + '!')).rejects.toThrow();
  });
});

describe('invitation expiry', () => {
  it(`lasts ${INVITE_TTL_DAYS} days`, () => {
    const from = new Date('2026-10-20T10:00:00Z');
    expect(inviteExpiry(from).toISOString()).toBe('2026-10-27T10:00:00.000Z');
  });
  it('is expired at and after the expiry instant', () => {
    const exp = '2026-10-27T10:00:00Z';
    expect(isInviteExpired(exp, new Date('2026-10-27T09:59:59Z'))).toBe(false);
    expect(isInviteExpired(exp, new Date('2026-10-27T10:00:00Z'))).toBe(true);
  });
  it('builds the invite link on the app host', () => {
    expect(inviteUrl('https://app.theimpactos.in/', 'tok')).toBe('https://app.theimpactos.in/invite/tok');
  });
});
