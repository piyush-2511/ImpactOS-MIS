/** Where file bytes live. Postgres stores metadata only (storage_files); never file bytes (hard rule 10). */
export type PresignedUpload = { url: string; method: 'PUT'; headers: Record<string, string> };

export interface StorageProvider {
  readonly kind: 'r2' | 'drive' | 'local';
  /** Server-side upload (small files, generated PDFs, Drive). */
  put(key: string, body: Uint8Array, mime: string): Promise<{ id: string }>;
  /** Direct browser upload. Providers that cannot presign (Drive) return null and the app uploads via the server. */
  presignUpload(key: string, mime: string, size: number): Promise<PresignedUpload | null>;
  /** Short-lived download URL, or null when the app must stream the bytes itself. */
  signedUrl(key: string, filename: string, expiresSeconds?: number): Promise<string | null>;
  get(key: string): Promise<Uint8Array | null>;
  head(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
}

/** Allowed uploads by purpose: type list and size cap. Images are compressed in the browser before upload (phase 8). */
export const UPLOAD_RULES: Record<string, { mime: RegExp; maxBytes: number }> = {
  attachment: {
    mime: /^(application\/pdf|image\/(jpeg|png|webp)|application\/vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet)|text\/csv)$/,
    maxBytes: 20 * 1024 * 1024,
  },
  photo: { mime: /^image\/(jpeg|png|webp|heic|heif)$/, maxBytes: 15 * 1024 * 1024 },
  document: {
    mime: /^(application\/pdf|image\/(jpeg|png|webp)|application\/vnd\.openxmlformats-officedocument\.[a-z.]+)$/,
    maxBytes: 50 * 1024 * 1024,
  },
  generated: {
    mime: /^(application\/pdf|text\/csv|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)$/,
    maxBytes: 50 * 1024 * 1024,
  },
};

/** Object key: org/purpose/yyyy/mm/<fileId>/<safe name>. The file id makes keys unguessable and unique. */
export function objectKey(orgId: string, purpose: string, fileId: string, name: string, now = new Date()): string {
  const safe =
    name
      .normalize('NFKD')
      .replace(/[^\w.\- ]+/g, '')
      .replace(/\s+/g, '-')
      .slice(-120) || 'file';
  return `${orgId}/${purpose}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${fileId}/${safe}`;
}
