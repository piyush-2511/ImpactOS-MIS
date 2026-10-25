'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FileIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileField } from './FileField';

export type Attachment = { id: string; name: string; sizeLabel: string; addedLabel: string; canDelete: boolean };

/** Files attached to a record (consent forms, bills, certificates): list, open, add, remove. */
export function AttachmentsPanel({
  entity,
  entityId,
  files,
  canUpload,
  purpose = 'attachment',
}: {
  entity: string;
  entityId: string;
  files: Attachment[];
  canUpload: boolean;
  purpose?: string;
}) {
  const t = useTranslations('engine.files');
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold">{t('attachments')}</h3>
      {files.length === 0 && <p className="text-sm text-muted-foreground">{t('none')}</p>}
      <ul className="flex flex-col gap-2">
        {files.map((f) => (
          <li key={f.id} className="flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm">
            <FileIcon className="size-4 shrink-0" aria-hidden />
            <a href={`/api/files/${f.id}`} className="min-w-0 flex-1 truncate">
              {f.name}
            </a>
            <span className="text-xs text-muted-foreground">
              {f.sizeLabel} · {f.addedLabel}
            </span>
            {f.canDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('deleteFile', { name: f.name })}
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await fetch(`/api/files/${f.id}`, { method: 'DELETE' });
                    if (r.ok) {
                      toast.success(t('deleted'));
                      router.refresh();
                    } else toast.error(t('errors.failed'));
                  })
                }
              >
                <Trash2Icon aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {canUpload && (
        <FileField
          purpose={purpose}
          entity={entity}
          entityId={entityId}
          value={null}
          onChange={(f) => {
            if (f) {
              toast.success(t('added'));
              router.refresh();
            }
          }}
        />
      )}
    </section>
  );
}
