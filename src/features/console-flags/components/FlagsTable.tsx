'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { deleteFlagAction, setFlagAction } from '../actions';
import type { FlagRow } from '../queries';

export function FlagsTable({ flags, canEdit }: { flags: FlagRow[]; canEdit: boolean }) {
  const t = useTranslations('console.flags');
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      const r = await fn();
      if (r.ok) router.refresh();
      else toast.error(t(r.error === 'orgNotFound' ? 'orgNotFound' : 'failed'));
    });
  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <Card className="flex flex-col gap-3">
          <CardTitle>{t('add')}</CardTitle>
          <form
            className="grid gap-3 sm:grid-cols-4 sm:items-end"
            action={(fd) =>
              run(() =>
                setFlagAction({ key: fd.get('key'), orgSlug: fd.get('org'), enabled: true, note: fd.get('note') }),
              )
            }
          >
            <Label className="flex flex-col items-start gap-1">
              {t('key')}
              <Input name="key" required placeholder="ai_chat" className="font-mono" />
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t('org')}
              <Input name="org" placeholder={t('everyone')} />
            </Label>
            <Label className="flex flex-col items-start gap-1">
              {t('note')}
              <Input name="note" maxLength={200} />
            </Label>
            <Button type="submit" disabled={pending}>
              {t('enable')}
            </Button>
          </form>
        </Card>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('key')}</TableHead>
            <TableHead>{t('scope')}</TableHead>
            <TableHead>{t('note')}</TableHead>
            <TableHead>{t('on')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('delete')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flags.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-mono">{f.key}</TableCell>
              <TableCell>{f.orgName ?? t('everyone')}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{f.note ?? '—'}</TableCell>
              <TableCell>
                <Switch
                  checked={f.enabled}
                  disabled={!canEdit || pending}
                  aria-label={t('toggle', { key: f.key })}
                  onCheckedChange={(v) =>
                    run(() => setFlagAction({ key: f.key, orgSlug: '', enabled: v, note: f.note ?? '' }))
                  }
                />
              </TableCell>
              <TableCell className="text-right">
                {canEdit && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => run(() => deleteFlagAction({ id: f.id }))}
                  >
                    {t('delete')}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
