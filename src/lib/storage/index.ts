import 'server-only';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { R2Storage } from './r2';
import type { StorageProvider } from './provider';

export * from './provider';

/** Development only: files on local disk under .data/files (never used in production). */
class LocalStorage implements StorageProvider {
  readonly kind = 'local' as const;
  private root = resolve(process.cwd(), '.data', 'files');
  private path(key: string) {
    const p = resolve(this.root, key);
    if (!p.startsWith(this.root)) throw new Error('bad key');
    return p;
  }
  async put(key: string, body: Uint8Array) {
    await mkdir(dirname(this.path(key)), { recursive: true });
    await writeFile(this.path(key), body);
    return { id: key };
  }
  async presignUpload() {
    return null;
  }
  async signedUrl() {
    return null;
  }
  async get(key: string) {
    try {
      return new Uint8Array(await readFile(this.path(key)));
    } catch {
      return null;
    }
  }
  async head(key: string) {
    try {
      return { size: (await stat(this.path(key))).size };
    } catch {
      return null;
    }
  }
  async delete(key: string) {
    await rm(this.path(key), { force: true });
    void join;
  }
}

let r2: R2Storage | null = null;

/** Default storage: Cloudflare R2 when configured; local disk in development; an error in production otherwise. */
export function defaultStorage(): StorageProvider {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
  if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET) {
    r2 ??= new R2Storage(R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY);
    return r2;
  }
  if (process.env.NODE_ENV === 'production') throw new Error('R2 storage is not configured');
  return new LocalStorage();
}

/** Storage for a stored file row (Drive files need the organisation's connection). */
export async function storageFor(file: {
  provider: 'r2' | 'drive' | 'local';
  organization_id: string;
}): Promise<StorageProvider> {
  if (file.provider !== 'drive') return defaultStorage();
  const { supabaseAdmin } = await import('@/lib/supabase/admin');
  const { data } = await supabaseAdmin()
    .from('drive_connections')
    .select('refresh_token_enc, folder_id, status')
    .eq('organization_id', file.organization_id)
    .single();
  if (!data || data.status !== 'connected') throw new Error('drive_not_connected');
  const { DriveStorage } = await import('./google-drive');
  return new DriveStorage(data.refresh_token_enc, data.folder_id);
}
