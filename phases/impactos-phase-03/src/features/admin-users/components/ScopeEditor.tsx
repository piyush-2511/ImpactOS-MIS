'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { setMemberScopesAction } from '../actions';

export type ScopeOption = { id: string; name: string };

/**
 * Programs and branches a person with an "assigned" role may see. Program and branch lists appear once those modules
 * exist (phases 6–7); until then the editor explains that the person sees what their role allows.
 */
export function ScopeEditor({
  memberId,
  hasAllScope,
  programs,
  branches,
  current,
  disabled,
}: {
  memberId: string;
  hasAllScope: boolean;
  programs: ScopeOption[];
  branches: ScopeOption[];
  current: string[];
  disabled?: boolean;
}) {
  const t = useTranslations('admin.scope');
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(current);
  const [pending, start] = useTransition();

  if (hasAllScope) return <p className="text-sm text-muted-foreground">{t('all')}</p>;
  if (!programs.length && !branches.length) return <p className="text-sm text-muted-foreground">{t('nothingYet')}</p>;

  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s, id] : s.filter((x) => x !== id)));
  function save() {
    start(async () => {
      const res = await setMemberScopesAction({
        memberId,
        programs: selected.filter((id) => programs.some((p) => p.id === id)),
        branches: selected.filter((id) => branches.some((b) => b.id === id)),
      });
      if (!res.ok) return void toast.error(t('failed'));
      toast.success(t('saved'));
      router.refresh();
    });
  }
  const group = (title: string, items: ScopeOption[]) =>
    items.length > 0 && (
      <div className="flex flex-col gap-2">
        <span className="text-sm font-semibold">{title}</span>
        {items.map((o) => (
          <div key={o.id} className="flex items-center gap-3">
            <Checkbox
              id={`scope-${o.id}`}
              checked={selected.includes(o.id)}
              onCheckedChange={(v) => toggle(o.id, v === true)}
              disabled={disabled || pending}
            />
            <Label htmlFor={`scope-${o.id}`} className="font-normal">
              {o.name}
            </Label>
          </div>
        ))}
      </div>
    );
  return (
    <div className="flex flex-col gap-3">
      {group(t('programs'), programs)}
      {group(t('branches'), branches)}
      {!disabled && (
        <Button type="button" size="sm" className="self-start" onClick={save} disabled={pending}>
          {t('save')}
        </Button>
      )}
    </div>
  );
}
