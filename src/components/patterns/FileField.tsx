'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export type StoredFile = { id: string; name: string };

/** Upload one file: ask the server for an upload slot, send the bytes (direct to R2 when possible), then confirm. */
export async function uploadFile(
  file: File,
  opts: { purpose: string; entity?: string; entityId?: string; onProgress?: (p: number) => void },
): Promise<StoredFile> {
  const res = await fetch('/api/files/presign', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      purpose: opts.purpose,
      entity: opts.entity,
      entityId: opts.entityId,
    }),
  });
  const slot = (await res.json()) as {
    fileId?: string;
    url?: string;
    headers?: Record<string, string>;
    error?: string;
  };
  if (!res.ok || !slot.fileId || !slot.url) throw new Error(slot.error ?? 'presign');
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', slot.url!);
    for (const [k, v] of Object.entries(slot.headers ?? {})) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => e.lengthComputable && opts.onProgress?.(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error('upload')));
    xhr.onerror = () => reject(new Error('network'));
    xhr.send(file);
  });
  const done = await fetch(`/api/files/${slot.fileId}`, { method: 'POST' });
  if (!done.ok) throw new Error('confirm');
  return { id: slot.fileId, name: file.name };
}

export function FileField({
  id,
  purpose,
  entity,
  entityId,
  value,
  onChange,
  disabled,
  accept,
}: {
  id?: string;
  purpose: string;
  entity?: string;
  entityId?: string;
  value: StoredFile | null;
  onChange: (f: StoredFile | null) => void;
  disabled?: boolean;
  accept?: string;
}) {
  const t = useTranslations('engine.files');
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string>();

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    setProgress(0);
    try {
      onChange(await uploadFile(file, { purpose, entity, entityId, onProgress: setProgress }));
    } catch (e) {
      const code = (e as Error).message;
      setError(['tooLarge', 'typeNotAllowed', 'network'].includes(code) ? code : 'failed');
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
          <FileIcon className="size-4" aria-hidden />
          <a href={`/api/files/${value.id}`} className="flex-1 truncate">
            {value.name}
          </a>
          {!disabled && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={t('remove')}
              onClick={() => onChange(null)}
            >
              <XIcon aria-hidden />
            </Button>
          )}
        </div>
      ) : (
        <input
          ref={input}
          id={id}
          type="file"
          accept={accept}
          disabled={disabled || progress !== null}
          onChange={(e) => pick(e.target.files?.[0])}
          className="min-h-11 rounded-lg border border-input bg-card px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1"
        />
      )}
      {progress !== null && <Progress value={progress} aria-label={t('uploading')} />}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  );
}
