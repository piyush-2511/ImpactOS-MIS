import 'server-only';
import { decryptSecret } from '@/lib/crypto/encrypt';
import type { StorageProvider } from './provider';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://www.googleapis.com/drive/v3';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

/** OAuth client for the Drive connection: separate from Google sign-in (different client, narrow drive.file scope). */
export function driveOAuthConfig() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('Google Drive is not configured');
  return { clientId, clientSecret };
}

export async function exchangeCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = driveOAuthConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
  return (await res.json()) as { access_token: string; refresh_token?: string; id_token?: string; expires_in: number };
}

async function accessToken(refreshTokenEnc: string): Promise<string> {
  const { clientId, clientSecret } = driveOAuthConfig();
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    body: new URLSearchParams({
      refresh_token: await decryptSecret(refreshTokenEnc),
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(res.status === 400 ? 'drive_revoked' : `Google token refresh failed (${res.status})`);
  return ((await res.json()) as { access_token: string }).access_token;
}

/** Creates the "ImpactOS" folder in the connected account (the app only sees files it created: drive.file). */
export async function createFolder(token: string, name = 'ImpactOS'): Promise<string> {
  const res = await fetch(`${API}/files?fields=id`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!res.ok) throw new Error(`Drive folder creation failed (${res.status})`);
  return ((await res.json()) as { id: string }).id;
}

/** An organisation's Drive as storage. Keys are Drive file ids; downloads are streamed by /api/files/[id]. */
export class DriveStorage implements StorageProvider {
  readonly kind = 'drive' as const;
  private token: Promise<string> | null = null;
  constructor(
    private refreshTokenEnc: string,
    private folderId: string | null,
  ) {}
  private auth() {
    this.token ??= accessToken(this.refreshTokenEnc);
    return this.token;
  }
  async put(key: string, body: Uint8Array, mime: string) {
    const name = key.split('/').pop() ?? 'file';
    const boundary = `ios${crypto.randomUUID()}`;
    const meta = JSON.stringify({
      name,
      parents: this.folderId ? [this.folderId] : undefined,
      appProperties: { impactosKey: key },
    });
    const head = new TextEncoder().encode(
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
    );
    const tail = new TextEncoder().encode(`\r\n--${boundary}--`);
    const payload = new Uint8Array(head.length + body.length + tail.length);
    payload.set(head, 0);
    payload.set(body, head.length);
    payload.set(tail, head.length + body.length);
    const res = await fetch(`${UPLOAD}?uploadType=multipart&fields=id`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.auth()}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: payload,
    });
    if (!res.ok) throw new Error(`Drive upload failed (${res.status})`);
    return { id: ((await res.json()) as { id: string }).id };
  }
  async presignUpload() {
    return null;
  }
  async signedUrl() {
    return null;
  }
  async get(fileId: string) {
    const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${await this.auth()}` },
    });
    return res.ok ? new Uint8Array(await res.arrayBuffer()) : null;
  }
  async head(fileId: string) {
    const res = await fetch(`${API}/files/${encodeURIComponent(fileId)}?fields=size`, {
      headers: { Authorization: `Bearer ${await this.auth()}` },
    });
    return res.ok ? { size: Number(((await res.json()) as { size?: string }).size ?? 0) } : null;
  }
  async delete(fileId: string) {
    await fetch(`${API}/files/${encodeURIComponent(fileId)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${await this.auth()}` },
    });
  }
}
