import { describe, expect, it } from 'vitest';
import { generatePassword, isSyntheticEmail, isValidUsername, normalizeUsername, syntheticEmail, usernameLoginKey } from '@/lib/auth/username';
import { memoryLimit } from '@/lib/auth/ratelimit';
import { sendEmail } from '@/lib/email/send';
import { createElement } from 'react';

describe('usernames', () => {
  it.each(['sunita.k', 'rk', 'a1b', 'field.staff.01'])('accepts %s when 3–30 chars', (u) => {
    expect(isValidUsername(u)).toBe(u.length >= 3);
  });
  it.each(['.sunita', 'sunita.', 'su..nita', 'Sunita', 'su nita', 'a'.repeat(31), 'sunita@k'])('rejects %s', (u) => {
    expect(isValidUsername(u)).toBe(false);
  });
  it('normalises spaces and case', () => {
    expect(normalizeUsername('  Sunita K ')).toBe('sunita.k');
  });
});

describe('synthetic emails', () => {
  it('are non-routable addresses under the synthetic domain', () => {
    const e = syntheticEmail('sunita.k');
    expect(e).toMatch(/^sunita\.k\.[0-9a-f]{8}@users\.id\.theimpactos\.in$/);
    expect(isSyntheticEmail(e)).toBe(true);
    expect(isSyntheticEmail('sunita@gmail.com')).toBe(false);
    expect(isSyntheticEmail('x@USERS.ID.THEIMPACTOS.IN')).toBe(true);
  });
  it('never receive email', async () => {
    const res = await sendEmail({ to: syntheticEmail('sunita.k'), subject: 'Test', react: createElement('p', null, 'hello') });
    expect(res).toEqual({ sent: false, reason: 'synthetic' });
  });
});

describe('initial passwords for printed slips', () => {
  it('are 12 readable characters with upper, lower and a digit', () => {
    for (let i = 0; i < 50; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/[a-z]/);
      expect(p).toMatch(/[A-Z]/);
      expect(p).toMatch(/\d/);
      expect(p).not.toMatch(/[0O1lI]/);
    }
  });
});

describe('username login rate limit', () => {
  it('locks after 5 tries in 15 minutes per org + username, then frees up', () => {
    const key = usernameLoginKey('ambedkar-foundation', 'Sunita.K');
    expect(key).toBe('ulogin:ambedkar-foundation:sunita.k');
    const t0 = 1_800_000_000_000;
    for (let i = 0; i < 5; i++) expect(memoryLimit(key, 5, 900, t0 + i).ok).toBe(true);
    const blocked = memoryLimit(key, 5, 900, t0 + 10);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(memoryLimit(key, 5, 900, t0 + 900_001).ok).toBe(true);
  });
});
