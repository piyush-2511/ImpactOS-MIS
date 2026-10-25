'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { UserPlusIcon } from 'lucide-react';
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
import { LOCALE_LABELS } from '@/lib/i18n/config';
import { normalizeUsername } from '@/lib/auth/username';
import { createUsernameAccountAction } from '../actions';
import type { RoleOption } from '../queries';
import { PrintableSlip, type SlipData } from './PrintableSlip';

/** HR creates a sign-in for someone without email; the one-time password is shown once on a printable slip. */
export function UsernameAccountDialog({ roles, loginUrl }: { roles: RoleOption[]; loginUrl: string }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [slip, setSlip] = useState<SlipData | null>(null);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [touched, setTouched] = useState(false);
  const suggested = touched
    ? username
    : normalizeUsername(name)
        .replace(/[^a-z0-9.]/g, '')
        .slice(0, 30);
  const defaultRole = roles.find((r) => r.key === 'self_service')?.id ?? roles[0]?.id ?? '';

  function submit(fd: FormData) {
    setError(undefined);
    setFieldErrors({});
    start(async () => {
      const res = await createUsernameAccountAction({
        fullName: fd.get('fullName'),
        username: fd.get('username'),
        roleId: fd.get('roleId'),
        locale: fd.get('locale'),
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      setSlip({ ...res.data, loginUrl });
      router.refresh();
    });
  }

  function close(o: boolean) {
    setOpen(o);
    if (!o) {
      setSlip(null);
      setName('');
      setUsername('');
      setTouched(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <UserPlusIcon aria-hidden /> {t('users.createUsername')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{slip ? t('users.slipReady') : t('users.usernameTitle')}</DialogTitle>
          <DialogDescription>{slip ? t('users.slipIntro') : t('users.usernameIntro')}</DialogDescription>
        </DialogHeader>
        {slip ? (
          <PrintableSlip data={slip} />
        ) : (
          <form action={submit} className="flex flex-col gap-4" noValidate>
            {error && error !== 'invalid' && (
              <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad-fg">
                {t(`errors.${error}`)}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ua-name">{t('fields.fullName')}</Label>
              <Input
                id="ua-name"
                name="fullName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                aria-invalid={!!fieldErrors.fullName}
              />
              {fieldErrors.fullName && (
                <p role="alert" className="text-sm text-destructive">
                  {t(`errors.${fieldErrors.fullName}`)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ua-username">{t('fields.username')}</Label>
              <Input
                id="ua-username"
                name="username"
                value={suggested}
                onChange={(e) => {
                  setTouched(true);
                  setUsername(e.target.value.toLowerCase());
                }}
                autoCapitalize="none"
                className="font-mono"
                required
                aria-invalid={!!fieldErrors.username}
                aria-describedby="ua-username-hint"
              />
              <p id="ua-username-hint" className="text-sm text-muted-foreground">
                {t('users.usernameHint')}
              </p>
              {fieldErrors.username && (
                <p role="alert" className="text-sm text-destructive">
                  {t(`errors.${fieldErrors.username}`)}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ua-role">{t('fields.role')}</Label>
                <select
                  id="ua-role"
                  name="roleId"
                  defaultValue={defaultRole}
                  className="min-h-11 rounded-lg border border-input bg-card px-3"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ua-locale">{t('fields.language')}</Label>
                <select
                  id="ua-locale"
                  name="locale"
                  defaultValue="hi"
                  className="min-h-11 rounded-lg border border-input bg-card px-3"
                >
                  <option value="hi">{LOCALE_LABELS.hi}</option>
                  <option value="en">{LOCALE_LABELS.en}</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? t('saving') : t('users.createAccount')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
