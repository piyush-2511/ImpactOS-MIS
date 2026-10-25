'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { setMemberRolesAction } from '../actions';
import type { RoleOption } from '../queries';

/** Pick one or more roles. The database refuses Secretary changes by non-Secretaries and an empty set. */
export function RoleAssign({
  memberId,
  current,
  roles,
  disabled,
  onDone,
}: {
  memberId: string;
  current: string[];
  roles: RoleOption[];
  disabled?: boolean;
  onDone?: () => void;
}) {
  const t = useTranslations('admin');
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(current);
  const [pending, start] = useTransition();
  const changed = selected.length !== current.length || selected.some((s) => !current.includes(s));
  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));

  function save() {
    start(async () => {
      const res = await setMemberRolesAction({ memberId, roleIds: selected });
      if (!res.ok) return void toast.error(t(`errors.${res.fieldErrors?.roleIds ?? res.error}`));
      toast.success(t('users.rolesSaved'));
      router.refresh();
      onDone?.();
    });
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled || pending}>
      <legend className="mb-1 text-sm font-semibold">{t('users.roles')}</legend>
      {roles.map((r) => (
        <div key={r.id} className="flex items-start gap-3">
          <Checkbox
            id={`role-${memberId}-${r.id}`}
            checked={selected.includes(r.id)}
            onCheckedChange={(v) => toggle(r.id, v === true)}
          />
          <Label htmlFor={`role-${memberId}-${r.id}`} className="flex flex-col items-start gap-0.5 font-normal">
            <span className="font-semibold">{r.name}</span>
            {r.description && <span className="text-xs text-muted-foreground">{r.description}</span>}
          </Label>
        </div>
      ))}
      {!disabled && (
        <Button
          type="button"
          size="sm"
          className="self-start"
          onClick={save}
          disabled={!changed || selected.length === 0 || pending}
        >
          {t('users.saveRoles')}
        </Button>
      )}
    </fieldset>
  );
}
