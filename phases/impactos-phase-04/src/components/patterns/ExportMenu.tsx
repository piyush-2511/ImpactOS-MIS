'use client';

import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { DownloadIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ActionResult } from '@/lib/actions/result';

export type FilePayload = { fileName: string; mime: string; base64: string };
type ExportResult = ActionResult<FilePayload | { queued: true }>;

/** Save a base64 file returned by a server action. */
export function downloadBase64({ fileName, mime, base64 }: FilePayload) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Export the current filtered view. Large PDFs are prepared in the background and arrive as a notification. */
export function ExportMenu({
  onExport,
  formats = ['xlsx', 'csv', 'pdf'],
}: {
  onExport: (format: 'csv' | 'xlsx' | 'pdf') => Promise<ExportResult>;
  formats?: ('csv' | 'xlsx' | 'pdf')[];
}) {
  const t = useTranslations('engine.export');
  const [pending, start] = useTransition();
  const run = (f: 'csv' | 'xlsx' | 'pdf') =>
    start(async () => {
      const res = await onExport(f);
      if (!res.ok) return void toast.error(t('failed'));
      if ('queued' in res.data) return void toast.success(t('queued'));
      downloadBase64(res.data);
    });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending}>
          <DownloadIcon aria-hidden /> {pending ? t('preparing') : t('export')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.map((f) => (
          <DropdownMenuItem key={f} onSelect={() => run(f)}>
            {t(f)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
