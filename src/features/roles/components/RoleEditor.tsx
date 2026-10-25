'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { LockIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { groupByModule } from '@/lib/authz/permissions';
import { updateRoleAction } from '../actions';
import type { RoleDetail } from '../queries';

type Perm = { key: string; module: string; description: string; sensitive: boolean };

/** System roles are shown read-only (clone to change); custom roles are fully editable. */
export function RoleEditor({
  role,
  catalogue,
  canManage,
}: {
  role: RoleDetail;
  catalogue: Perm[];
  canManage: boolean;
}) {
  const t = useTranslations('admin.roles');
  const te = useTranslations('admin.errors');
  const router = useRouter();
  const editable = canManage && !role.isSystem;
  const [perms, setPerms] = useState<string[]>(role.grantsAll ? catalogue.map((p) => p.key) : role.permissionKeys);
  const [mfa, setMfa] = useState(role.requiresMfa);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const groups = groupByModule(catalogue.map((p) => p.key));
  const byKey = new Map(catalogue.map((p) => [p.key, p]));

  function save(fd: FormData) {
    setError(undefined);
    start(async () => {
      const res = await updateRoleAction({
        roleId: role.id,
        name: fd.get('name'),
        description: fd.get('description'),
        defaultScope: fd.get('defaultScope'),
        requiresMfa: mfa,
        permissions: perms,
      });
      if (!res.ok) return void setError(res.fieldErrors?.name ?? res.error);
      toast.success(t('saved'));
      router.refresh();
    });
  }

  return (
    <form action={save} className="flex flex-col gap-4">
      {!editable && role.isSystem && (
        <p className="flex items-center gap-2 rounded-lg bg-info-bg px-3 py-2 text-sm text-info-fg">
          <LockIcon className="size-4" aria-hidden /> {t('systemLocked')}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm text-bad-fg">
          {te(error)}
        </p>
      )}
      <Card className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-name">{t('name')}</Label>
          <Input id="r-name" name="name" defaultValue={role.name} disabled={!editable} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="r-scope">{t('defaultScope')}</Label>
          <select
            id="r-scope"
            name="defaultScope"
            defaultValue={role.defaultScope}
            disabled={!editable}
            className="min-h-11 rounded-lg border border-input bg-card px-3"
          >
            {(['all', 'assigned', 'own'] as const).map((s) => (
              <option key={s} value={s}>
                {t(`scopes.${s}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5 md:col-span-2">
          <Label htmlFor="r-desc">{t('description')}</Label>
          <Textarea
            id="r-desc"
            name="description"
            defaultValue={role.description ?? ''}
            disabled={!editable}
            className="min-h-16"
          />
        </div>
        <div className="flex items-center gap-3 md:col-span-2">
          <Switch id="r-mfa" checked={mfa} onCheckedChange={setMfa} disabled={!editable} />
          <Label htmlFor="r-mfa" className="font-normal">
            {t('requiresMfa')}
          </Label>
        </div>
      </Card>
      <Card className="flex flex-col gap-4">
        <CardTitle>{t('permissionsTitle')}</CardTitle>
        {role.grantsAll && <p className="text-sm text-muted-foreground">{t('grantsAllNote')}</p>}
        {groups.map((g) => (
          <fieldset
            key={g.module}
            className="flex flex-col gap-2 border-t border-border/60 pt-3 first-of-type:border-t-0 first-of-type:pt-0"
          >
            <legend className="text-sm font-semibold">{t(`modules.${g.module}`)}</legend>
            {g.keys.map((k) => {
              const p = byKey.get(k)!;
              return (
                <div key={k} className="flex items-start gap-3">
                  <Checkbox
                    id={`p-${k}`}
                    checked={perms.includes(k)}
                    disabled={!editable}
                    onCheckedChange={(v) => setPerms((s) => (v === true ? [...s, k] : s.filter((x) => x !== k)))}
                  />
                  <Label htmlFor={`p-${k}`} className="flex flex-col items-start gap-0.5 font-normal">
                    <span>{t(`perm.${k.replaceAll('.', '_')}`)}</span>
                    <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                      {k}
                      {p.sensitive && <Badge tone="warn">{t('logged')}</Badge>}
                    </span>
                  </Label>
                </div>
              );
            })}
          </fieldset>
        ))}
      </Card>
      {editable && (
        <Button type="submit" className="self-start" disabled={pending}>
          {t('save')}
        </Button>
      )}
    </form>
  );
}
