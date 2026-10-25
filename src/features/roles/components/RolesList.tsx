'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CopyIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cloneRoleAction } from '../actions';
import type { RoleListRow } from '../queries';

export function CloneRoleDialog({ roles, defaultSource }: { roles: RoleListRow[]; defaultSource?: string }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const sources = roles.filter((r) => !r.grantsAll);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={defaultSource ? 'outline' : 'default'}>
          <CopyIcon aria-hidden /> {t('roles.clone')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('roles.cloneTitle')}</DialogTitle>
          <DialogDescription>{t('roles.cloneIntro')}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          action={(fd) =>
            start(async () => {
              const res = await cloneRoleAction({ sourceId: fd.get('sourceId'), name: fd.get('name') });
              if (!res.ok) return void setError(res.fieldErrors?.name ?? res.error);
              toast.success(t('roles.cloned'));
              setOpen(false);
              router.push(`/admin/roles/${res.data.id}`);
            })
          }
        >
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {t(`errors.${error}`)}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clone-src">{t('roles.startFrom')}</Label>
            <select
              id="clone-src"
              name="sourceId"
              defaultValue={defaultSource ?? sources[0]?.id}
              className="min-h-11 rounded-lg border border-input bg-card px-3"
            >
              {sources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="clone-name">{t('roles.newName')}</Label>
            <Input id="clone-name" name="name" required placeholder={t('roles.namePlaceholder')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {t('roles.createRole')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RolesList({ roles }: { roles: RoleListRow[] }) {
  const t = useTranslations('admin.roles');
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t('colRole')}</TableHead>
          <TableHead>{t('colKind')}</TableHead>
          <TableHead>{t('colScope')}</TableHead>
          <TableHead className="text-right">{t('colPeople')}</TableHead>
          <TableHead className="text-right">{t('colPermissions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {roles.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Link href={`/admin/roles/${r.id}`} className="font-semibold">
                {r.name}
              </Link>
              {r.description && <div className="max-w-md text-xs text-muted-foreground">{r.description}</div>}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                <Badge tone={r.isSystem ? 'neutral' : 'idea'}>{t(r.isSystem ? 'system' : 'custom')}</Badge>
                {r.requiresMfa && <Badge tone="warn">{t('mfa')}</Badge>}
              </div>
            </TableCell>
            <TableCell>{t(`scopes.${r.defaultScope}`)}</TableCell>
            <TableCell className="text-right font-mono">{r.members}</TableCell>
            <TableCell className="text-right font-mono">{r.grantsAll ? t('allPermissions') : r.permissions}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
