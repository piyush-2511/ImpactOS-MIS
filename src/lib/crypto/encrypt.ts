import 'server-only';

/**
 * AES-256-GCM for secrets at rest (Google Drive refresh tokens, later gateway keys and full Aadhaar where the law asks).
 * Key: TOKEN_ENCRYPTION_KEY = 32 random bytes, base64. Format: v1.<iv b64url>.<ciphertext+tag b64url>.
 */
const b64u = (b: ArrayBuffer | Uint8Array) =>
  Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString('base64url');

async function key(raw = process.env.TOKEN_ENCRYPTION_KEY): Promise<CryptoKey> {
  if (!raw) throw new Error('TOKEN_ENCRYPTION_KEY is not set');
  const bytes = Buffer.from(raw, 'base64');
  if (bytes.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (base64)');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(plain: string, rawKey?: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(rawKey), new TextEncoder().encode(plain));
  return `v1.${b64u(iv)}.${b64u(ct)}`;
}

export async function decryptSecret(packed: string, rawKey?: string): Promise<string> {
  const [v, iv, ct] = packed.split('.');
  if (v !== 'v1' || !iv || !ct) throw new Error('Unknown secret format');
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: Buffer.from(iv, 'base64url') },
    await key(rawKey),
    Buffer.from(ct, 'base64url'),
  );
  return new TextDecoder().decode(pt);
}
