'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { MailPlusIcon } from 'lucide-react';
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
import { inviteMemberAction } from '../actions';
import type { RoleOption } from '../queries';

export function InviteDialog({ roles }: { roles: RoleOption[] }) {
  const t = useTranslations('admin');
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [devLink, setDevLink] = useState<string | null>(null);
  const defaultRole = roles.find((r) => r.key === 'viewer')?.id ?? roles[0]?.id ?? '';

  function submit(fd: FormData) {
    setError(undefined);
    setFieldErrors({});
    start(async () => {
      const res = await inviteMemberAction({
        email: fd.get('email'),
        roleId: fd.get('roleId'),
        locale: fd.get('locale'),
      });
      if (!res.ok) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
        return;
      }
      toast.success(t('users.invited', { email: res.data.email }));
      router.refresh();
      if (res.data.devLink) setDevLink(res.data.devLink);
      else setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setDevLink(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <MailPlusIcon aria-hidden /> {t('users.invite')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t('close')}>
        <DialogHeader>
          <DialogTitle>{t('users.inviteTitle')}</DialogTitle>
          <DialogDescription>{t('users.inviteIntro')}</DialogDescription>
        </DialogHeader>
        {devLink ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>{t('users.devLink')}</p>
            <a href={devLink} className="break-all font-mono">
              {devLink}
            </a>
          </div>
        ) : (
          <form action={submit} className="flex flex-col gap-4" noValidate>
            {error && error !== 'invalid' && (
              <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad-fg">
                {t(`errors.${error}`)}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-email">{t('fields.email')}</Label>
              <Input
                id="inv-email"
                name="email"
                type="email"
                autoComplete="off"
                required
                aria-invalid={!!fieldErrors.email}
              />
              {fieldErrors.email && (
                <p role="alert" className="text-sm text-destructive">
                  {t(`errors.${fieldErrors.email}`)}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inv-role">{t('fields.role')}</Label>
              <select
                id="inv-role"
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
              <Label htmlFor="inv-locale">{t('fields.emailLanguage')}</Label>
              <select
                id="inv-locale"
                name="locale"
                defaultValue={locale}
                className="min-h-11 rounded-lg border border-input bg-card px-3"
              >
                <option value="en">{LOCALE_LABELS.en}</option>
                <option value="hi">{LOCALE_LABELS.hi}</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={pending}>
                {pending ? t('sending') : t('users.sendInvite')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
