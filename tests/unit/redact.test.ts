import { describe, expect, it } from 'vitest';
import { redactPII } from '@/lib/ai/redact';
import { decryptSecret, encryptSecret } from '@/lib/crypto/encrypt';

describe('redactPII', () => {
  it('removes emails, phones, Aadhaar, PAN, IFSC, accounts and UPI ids', () => {
    const input =
      'Rinki (9835124700, rinki@example.com) Aadhaar 4821 6732 9910, PAN ABCDE1234F, SBIN0003520 a/c 123456789012, upi rinki@okhdfcbank';
    const { text, removed } = redactPII(input);
    expect(text).not.toMatch(/9835124700|rinki@example|4821 6732 9910|ABCDE1234F|SBIN0003520|123456789012|okhdfcbank/);
    expect(removed).toMatchObject({ email: 1, phone: 1, aadhaar: 1, pan: 1, ifsc: 1, account: 1, upi: 1 });
  });
  it('keeps ordinary numbers like ages, amounts and dates', () => {
    expect(redactPII('24 girls, ₹5,000 on 17/10/2026').text).toBe('24 girls, ₹5,000 on 17/10/2026');
  });
  it('removes names it is given', () => {
    expect(redactPII('Rinki Kumari attended', ['Rinki Kumari']).text).toBe('[NAME] attended');
  });
});

describe('secret encryption', () => {
  const key = Buffer.alloc(32, 7).toString('base64');
  it('round-trips and never stores plain text', async () => {
    const enc = await encryptSecret('1//refresh-token', key);
    expect(enc).toMatch(/^v1\./);
    expect(enc).not.toContain('refresh-token');
    expect(await decryptSecret(enc, key)).toBe('1//refresh-token');
  });
  it('fails with the wrong key (tamper-evident)', async () => {
    const enc = await encryptSecret('x', key);
    await expect(decryptSecret(enc, Buffer.alloc(32, 8).toString('base64'))).rejects.toThrow();
  });
});
